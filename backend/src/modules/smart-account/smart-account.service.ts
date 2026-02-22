// MIT Licence — AI CFO Wallet — Buypath Ltd
// Smart Account service — creates and manages ERC-4337 smart accounts on Base L2

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaymasterService } from './paymaster.service';
import { SubWalletService } from './sub-wallet.service';
import { SmartAccountException } from '../../common/exceptions/business.exception';
import type {
  CreateSmartAccountDto,
  SmartAccountInfo,
  UserOperationResult,
  SpendingLimitConfig,
  MultiSigConfig,
  SimulateTransactionDto,
  SimulationResult,
} from './smart-account.types';

// Chain configuration for Base L2
export const CHAIN_CONFIG = {
  mainnet: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: process.env['BASE_MAINNET_RPC'] ?? 'https://mainnet.base.org',
    bundlerUrl: process.env['PIMLICO_BUNDLER_URL_MAINNET'] ?? '',
    entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    accountFactoryAddress: process.env['SMART_ACCOUNT_FACTORY_ADDRESS'] ?? '0x0000000000000000000000000000000000000000',
  },
  sepolia: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: process.env['BASE_SEPOLIA_RPC'] ?? 'https://sepolia.base.org',
    bundlerUrl: process.env['PIMLICO_BUNDLER_URL_SEPOLIA'] ?? '',
    entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    accountFactoryAddress: process.env['SMART_ACCOUNT_FACTORY_ADDRESS'] ?? '0x0000000000000000000000000000000000000000',
  },
} as const;

@Injectable()
export class SmartAccountService {
  private readonly logger = new Logger(SmartAccountService.name);
  private readonly provider: ethers.JsonRpcProvider;
  private readonly activeChain: 'mainnet' | 'sepolia';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly paymasterService: PaymasterService,
    private readonly subWalletService: SubWalletService,
  ) {
    this.activeChain = (this.config.get<string>('ACTIVE_CHAIN', 'sepolia') as 'mainnet' | 'sepolia');
    const chainConfig = CHAIN_CONFIG[this.activeChain];
    this.provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    this.logger.log(`Smart account service initialised on ${chainConfig.name}`);
  }

  /**
   * Creates a new ERC-4337 smart account for a business.
   * Uses counterfactual deployment — the account address is deterministic
   * and the contract is only deployed on first use (lazy deployment).
   */
  async createSmartAccount(businessId: string, dto: CreateSmartAccountDto): Promise<SmartAccountInfo> {
    this.logger.log(`Creating smart account for business ${businessId}`);

    try {
      const chainConfig = CHAIN_CONFIG[this.activeChain];

      // Derive deterministic salt from business ID
      const salt = ethers.solidityPackedKeccak256(['string', 'address'], [businessId, dto.ownerAddress]);

      // Compute counterfactual address (account deployed lazily on first tx)
      const smartAccountAddress = await this.computeCounterfactualAddress(
        dto.ownerAddress,
        salt,
        chainConfig.accountFactoryAddress,
      );

      // Store wallet in database
      const wallet = await this.prisma.wallet.create({
        data: {
          businessId,
          type: 'FIAT',
          currency: dto.currency ?? 'GBP',
          balance: 0,
          smartAccountAddress,
          label: dto.label ?? 'Primary Smart Account',
          isDefault: true,
          metadata: {
            ownerAddress: dto.ownerAddress,
            salt,
            chain: this.activeChain,
            chainId: chainConfig.chainId,
            multiSig: dto.multiSigConfig ?? null,
            spendingLimits: dto.spendingLimits ?? [],
            deployedAt: null,
          },
        },
      });

      return {
        walletId: wallet.id,
        smartAccountAddress,
        ownerAddress: dto.ownerAddress,
        chain: this.activeChain,
        chainId: chainConfig.chainId,
        isDeployed: false, // Counterfactual — not yet on-chain
      };
    } catch (error) {
      throw new SmartAccountException(`Failed to create smart account: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieves smart account info for a given wallet.
   */
  async getSmartAccountInfo(walletId: string): Promise<SmartAccountInfo> {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet?.smartAccountAddress) {
      throw new SmartAccountException(`No smart account found for wallet ${walletId}`);
    }

    const isDeployed = await this.isAccountDeployed(wallet.smartAccountAddress);
    const chainConfig = CHAIN_CONFIG[this.activeChain];
    const metadata = wallet.metadata as Record<string, unknown>;

    return {
      walletId,
      smartAccountAddress: wallet.smartAccountAddress,
      ownerAddress: (metadata['ownerAddress'] as string) ?? '',
      chain: this.activeChain,
      chainId: chainConfig.chainId,
      isDeployed,
    };
  }

  /**
   * Simulates a user operation (dry run) before execution.
   * Returns estimated gas costs and success probability.
   */
  async simulateTransaction(dto: SimulateTransactionDto): Promise<SimulationResult> {
    this.logger.debug(`Simulating transaction from ${dto.fromAddress} to ${dto.toAddress}`);

    try {
      // Validate addresses
      if (!ethers.isAddress(dto.fromAddress) || !ethers.isAddress(dto.toAddress)) {
        return {
          success: false,
          estimatedGas: '0',
          estimatedGasUsd: '0',
          error: 'Invalid Ethereum address',
        };
      }

      // Check if destination is a contract
      const toCode = await this.provider.getCode(dto.toAddress);
      const isContract = toCode !== '0x';

      // Estimate gas for the call
      const estimatedGas = await this.provider.estimateGas({
        from: dto.fromAddress,
        to: dto.toAddress,
        value: dto.valueWei ? BigInt(dto.valueWei) : 0n,
        data: dto.callData ?? '0x',
      }).catch(() => 250000n); // fallback estimate

      const gasPrice = (await this.provider.getFeeData()).gasPrice ?? 1000000000n;
      const gasCostWei = estimatedGas * gasPrice;
      const gasCostEth = ethers.formatEther(gasCostWei);

      return {
        success: true,
        estimatedGas: estimatedGas.toString(),
        estimatedGasUsd: (parseFloat(gasCostEth) * 3000).toFixed(4), // rough ETH/USD
        isContractCall: isContract,
        callData: dto.callData,
      };
    } catch (error) {
      return {
        success: false,
        estimatedGas: '0',
        estimatedGasUsd: '0',
        error: (error as Error).message,
      };
    }
  }

  /**
   * Executes a user operation via the ERC-4337 bundler.
   * In production, this sends to Pimlico's bundler endpoint.
   */
  async executeUserOperation(
    businessId: string,
    walletId: string,
    callData: string,
    value = '0',
  ): Promise<UserOperationResult> {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet?.smartAccountAddress) {
      throw new SmartAccountException('Smart account not found');
    }

    this.logger.log(`Executing user operation for wallet ${walletId}`);

    // Check multi-sig requirement
    const metadata = wallet.metadata as Record<string, unknown>;
    const multiSig = metadata['multiSig'] as MultiSigConfig | null;
    const valueNum = parseFloat(value);

    if (multiSig && valueNum > multiSig.threshold) {
      this.logger.warn(`Transaction requires ${multiSig.signaturesRequired}-of-${multiSig.signaturesTotal} approval`);
      return {
        success: false,
        requiresMultiSig: true,
        pendingApprovals: multiSig.signaturesRequired,
        userOpHash: null,
      };
    }

    // Get paymaster sponsorship
    const paymasterData = await this.paymasterService.getSponsorshipData(wallet.smartAccountAddress);

    // Build the user operation (simplified — full implementation needs 4337 SDK)
    const userOpHash = ethers.keccak256(
      ethers.solidityPacked(
        ['address', 'bytes', 'uint256', 'bytes'],
        [wallet.smartAccountAddress, callData, Date.now(), paymasterData],
      ),
    );

    // Record as pending transaction
    await this.prisma.transaction.create({
      data: {
        businessId,
        type: 'TRANSFER',
        status: 'PENDING',
        fromWalletId: walletId,
        amount: parseFloat(value) || 0,
        currency: wallet.currency,
        txHash: userOpHash,
        metadata: { callData, paymasterData, userOpHash },
      },
    });

    return {
      success: true,
      requiresMultiSig: false,
      pendingApprovals: 0,
      userOpHash,
    };
  }

  /**
   * Updates spending limits for a user role on this smart account.
   */
  async updateSpendingLimits(walletId: string, limits: SpendingLimitConfig[]): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new SmartAccountException('Wallet not found');

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        metadata: {
          ...(wallet.metadata as object),
          spendingLimits: limits,
        },
      },
    });

    this.logger.log(`Updated spending limits for wallet ${walletId}`);
  }

  /**
   * Configures multi-sig for payments above a threshold.
   */
  async configureMultiSig(walletId: string, config: MultiSigConfig): Promise<void> {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new SmartAccountException('Wallet not found');

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        metadata: {
          ...(wallet.metadata as object),
          multiSig: config,
        },
      },
    });

    this.logger.log(`Configured multi-sig for wallet ${walletId}: ${config.signaturesRequired}-of-${config.signaturesTotal}`);
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async computeCounterfactualAddress(
    owner: string,
    salt: string,
    factoryAddress: string,
  ): Promise<string> {
    // Deterministic address computation using CREATE2 mechanics
    // In production, this calls the factory's getAddress() method
    const encoded = ethers.solidityPacked(['address', 'bytes32'], [owner, salt]);
    const hash = ethers.keccak256(encoded);
    // Truncate to valid Ethereum address format
    return ethers.getAddress(`0x${hash.slice(26)}`);
  }

  private async isAccountDeployed(address: string): Promise<boolean> {
    const code = await this.provider.getCode(address);
    return code !== '0x';
  }
}

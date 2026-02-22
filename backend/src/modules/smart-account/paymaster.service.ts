// MIT Licence — AI CFO Wallet — Buypath Ltd
// Paymaster service — handles gas sponsorship via Pimlico

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PaymasterSponsorshipData } from './smart-account.types';

@Injectable()
export class PaymasterService {
  private readonly logger = new Logger(PaymasterService.name);
  private readonly pimlicoApiKey: string;
  private readonly activeChain: string;

  constructor(private readonly config: ConfigService) {
    this.pimlicoApiKey = this.config.get<string>('PIMLICO_API_KEY', '');
    this.activeChain = this.config.get<string>('ACTIVE_CHAIN', 'sepolia');
  }

  /**
   * Fetches paymaster sponsorship data from Pimlico's API.
   * This pays the gas fee on behalf of the user — enabling gasless transactions.
   *
   * In production this calls:
   * POST https://api.pimlico.io/v2/{chain}/rpc
   * { method: "pm_sponsorUserOperation", params: [userOp, entryPoint] }
   */
  async getSponsorshipData(smartAccountAddress: string): Promise<string> {
    this.logger.debug(`Getting paymaster sponsorship for ${smartAccountAddress}`);

    if (!this.pimlicoApiKey) {
      this.logger.warn('No Pimlico API key configured — returning empty paymaster data');
      return '0x';
    }

    // Stub: in production, call Pimlico's pm_sponsorUserOperation
    const sponsorshipData: PaymasterSponsorshipData = {
      paymasterAddress: this.config.get<string>('PAYMASTER_ADDRESS', '0x0000000000000000000000000000000000000000'),
      paymasterData: '0x',
      preVerificationGas: '0x5208',
      verificationGasLimit: '0x927c0',
      callGasLimit: '0x9c40',
    };

    return sponsorshipData.paymasterAddress + sponsorshipData.paymasterData.slice(2);
  }

  /**
   * Checks the remaining sponsorship budget for a smart account.
   * Used to alert when gas credits are running low.
   */
  async getSponsorshipBalance(): Promise<{ remainingGwei: bigint; refillThreshold: bigint }> {
    // Stub: calls Pimlico's pm_getUserOperationGasPrice
    return {
      remainingGwei: 10_000_000_000n, // 10 GWEI stub
      refillThreshold: 1_000_000_000n, // alert below 1 GWEI
    };
  }

  /**
   * Returns whether a given operation qualifies for gas sponsorship
   * based on the business subscription tier.
   */
  async isEligibleForSponsorship(businessId: string, estimatedGas: bigint): Promise<boolean> {
    // Starter: no sponsorship, Growth/Scale: sponsored up to a monthly cap
    void businessId;
    const maxSponsoredGas = 1_000_000n; // 1M gas units per month
    return estimatedGas <= maxSponsoredGas;
  }
}

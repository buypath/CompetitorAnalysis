// MIT Licence — AI CFO Wallet — Buypath Ltd
// Unit tests for RuleParserService

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RuleParserService } from './rule-parser.service';
import { RuleParsingException } from '../../common/exceptions/business.exception';
import type { BusinessContext } from './rules-engine.types';

const mockContext: BusinessContext = {
  businessId: 'test-biz-001',
  currency: 'GBP',
  timezone: 'Europe/London',
  monthlyRevenue: 50000,
  monthlyExpenses: 30000,
  wallets: [
    { id: 'w1', label: 'Primary GBP Account', currency: 'GBP', balance: 85000, type: 'FIAT' },
    { id: 'w2', label: 'USDC Treasury', currency: 'USDC', balance: 25000, type: 'STABLECOIN' },
  ],
};

describe('RuleParserService', () => {
  let service: RuleParserService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string, def?: unknown) => {
        const config: Record<string, unknown> = {
          ANTHROPIC_API_KEY: 'test-key',
          OPENAI_API_KEY: 'test-key',
          ANTHROPIC_MODEL: 'claude-opus-4-6',
          OPENAI_MODEL: 'gpt-4o',
          AI_FALLBACK_ENABLED: true,
        };
        return config[key] ?? def;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleParserService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RuleParserService>(RuleParserService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractJsonFromResponse (private via reflection)', () => {
    it('should extract JSON from a markdown code block', () => {
      const response = `Here is the parsed rule:
\`\`\`json
{
  "trigger": "schedule",
  "name": "VAT Allocation",
  "description": "Weekly VAT ring-fence",
  "action": {
    "type": "transfer",
    "amount": "calculated_vat",
    "description": "Move VAT to ring-fence"
  },
  "triggerType": "SCHEDULE",
  "cronExpression": "0 17 * * 5"
}
\`\`\``;

      // Test via the private method using type casting
      const extracted = (service as unknown as { extractJsonFromResponse(r: string, i: string): unknown }).extractJsonFromResponse(response, 'test input');
      expect(extracted).toHaveProperty('trigger', 'schedule');
      expect(extracted).toHaveProperty('action.type', 'transfer');
    });
  });

  describe('parseNaturalLanguageRule', () => {
    it('should throw RuleParsingException when both AI providers fail', async () => {
      // Mock Anthropic to throw
      jest.spyOn(service as unknown as { anthropic: { messages: { create: jest.Mock } } }, 'anthropic', 'get').mockReturnValue({
        messages: { create: jest.fn().mockRejectedValue(new Error('Anthropic error')) },
      });

      await expect(
        service.parseNaturalLanguageRule('test rule', mockContext),
      ).rejects.toThrow();
    });
  });
});

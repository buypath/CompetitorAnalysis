// MIT Licence — AI CFO Wallet — Buypath Ltd
// Rule parser service — converts natural language rules into structured JSON
// using Claude API as primary, OpenAI as fallback

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { RULE_PARSER_PROMPT } from './prompts/rule-parser.prompt';
import { RuleParsingException } from '../../common/exceptions/business.exception';
import type { ParsedRule, BusinessContext } from './rules-engine.types';

@Injectable()
export class RuleParserService {
  private readonly logger = new Logger(RuleParserService.name);
  private readonly anthropic: Anthropic;
  private readonly openai: OpenAI;
  private readonly fallbackEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY', ''),
    });
    this.openai = new OpenAI({
      apiKey: this.config.get<string>('OPENAI_API_KEY', ''),
    });
    this.fallbackEnabled = this.config.get<boolean>('AI_FALLBACK_ENABLED', true);
  }

  /**
   * Parses a natural language rule string into structured JSON logic.
   *
   * Examples:
   *   "Keep 3 months operating expenses in GBP"
   *   → { trigger: "threshold", condition: { type: "balance_exceeds", ... }, action: { ... } }
   *
   *   "Move VAT aside weekly — 20% of revenue every Friday"
   *   → { trigger: "schedule", schedule: { cron: "0 17 * * 5" }, ... }
   */
  async parseNaturalLanguageRule(
    naturalLanguage: string,
    businessContext: BusinessContext,
  ): Promise<ParsedRule> {
    this.logger.debug(`Parsing rule: "${naturalLanguage}"`);

    try {
      return await this.parseWithClaude(naturalLanguage, businessContext);
    } catch (claudeError) {
      this.logger.warn(`Claude parsing failed, ${this.fallbackEnabled ? 'falling back to OpenAI' : 'no fallback'}: ${(claudeError as Error).message}`);

      if (this.fallbackEnabled) {
        try {
          return await this.parseWithOpenAi(naturalLanguage, businessContext);
        } catch (openAiError) {
          throw new RuleParsingException(
            `Both AI providers failed. Last error: ${(openAiError as Error).message}`,
          );
        }
      }

      throw new RuleParsingException((claudeError as Error).message);
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async parseWithClaude(
    naturalLanguage: string,
    businessContext: BusinessContext,
  ): Promise<ParsedRule> {
    const model = this.config.get<string>('ANTHROPIC_MODEL', 'claude-opus-4-6');

    const message = await this.anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: RULE_PARSER_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Business context:\n${JSON.stringify(businessContext, null, 2)}\n\nRule to parse:\n"${naturalLanguage}"`,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    this.logger.debug(`Claude tokens used: input=${message.usage.input_tokens}, output=${message.usage.output_tokens}`);

    return this.extractJsonFromResponse(responseText, naturalLanguage);
  }

  private async parseWithOpenAi(
    naturalLanguage: string,
    businessContext: BusinessContext,
  ): Promise<ParsedRule> {
    const model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o');

    const completion = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: RULE_PARSER_PROMPT },
        {
          role: 'user',
          content: `Business context:\n${JSON.stringify(businessContext, null, 2)}\n\nRule to parse:\n"${naturalLanguage}"`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    });

    const responseText = completion.choices[0]?.message?.content ?? '{}';
    return this.extractJsonFromResponse(responseText, naturalLanguage);
  }

  private extractJsonFromResponse(response: string, originalInput: string): ParsedRule {
    // Extract JSON from the response (Claude may include explanatory text)
    const jsonMatch = response.match(/```json\n?([\s\S]+?)\n?```/) ??
      response.match(/\{[\s\S]+\}/);

    if (!jsonMatch) {
      throw new RuleParsingException(`No JSON found in AI response for: "${originalInput}"`);
    }

    const jsonStr = jsonMatch[1] ?? jsonMatch[0];

    try {
      const parsed = JSON.parse(jsonStr) as ParsedRule;
      this.validateParsedRule(parsed);
      return parsed;
    } catch (e) {
      throw new RuleParsingException(`Invalid JSON in AI response: ${(e as Error).message}`);
    }
  }

  private validateParsedRule(rule: ParsedRule): void {
    if (!rule.trigger) throw new RuleParsingException('Missing "trigger" field');
    if (!rule.action) throw new RuleParsingException('Missing "action" field');
    if (!['schedule', 'threshold', 'event'].includes(rule.trigger)) {
      throw new RuleParsingException(`Invalid trigger type: ${rule.trigger}`);
    }
  }
}

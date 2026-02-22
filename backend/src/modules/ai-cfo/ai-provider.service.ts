// MIT Licence — AI CFO Wallet — Buypath Ltd
// AI provider service — wraps Anthropic (primary) and OpenAI (fallback)
// with token tracking and Redis caching

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AiServiceException } from '../../common/exceptions/business.exception';

export interface AiRequestOptions {
  cacheKey?: string;        // Redis cache key — omit to skip caching
  cacheTtlSeconds?: number; // Cache TTL (default: 3600)
  maxTokens?: number;
  temperature?: number;     // Only for OpenAI fallback
}

export interface AiResponse {
  content: string;
  provider: 'anthropic' | 'openai';
  model: string;
  tokensUsed: { input: number; output: number; total: number };
  fromCache: boolean;
}

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  private readonly anthropic: Anthropic;
  private readonly openai: OpenAI;
  private readonly fallbackEnabled: boolean;

  // In-memory cache (replace with Redis in production)
  private readonly cache = new Map<string, { value: AiResponse; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {
    this.anthropic = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY', '') });
    this.openai = new OpenAI({ apiKey: this.config.get<string>('OPENAI_API_KEY', '') });
    this.fallbackEnabled = this.config.get<boolean>('AI_FALLBACK_ENABLED', true);
  }

  /**
   * Sends a prompt to Anthropic Claude, with optional caching and OpenAI fallback.
   */
  async complete(
    systemPrompt: string,
    userMessage: string,
    options: AiRequestOptions = {},
  ): Promise<AiResponse> {
    // Check cache
    if (options.cacheKey) {
      const cached = this.getFromCache(options.cacheKey);
      if (cached) return { ...cached, fromCache: true };
    }

    let response: AiResponse;
    try {
      response = await this.callAnthropic(systemPrompt, userMessage, options);
    } catch (anthropicError) {
      this.logger.warn(`Anthropic failed: ${(anthropicError as Error).message}`);

      if (!this.fallbackEnabled) {
        throw new AiServiceException('Anthropic', (anthropicError as Error).message);
      }

      try {
        response = await this.callOpenAi(systemPrompt, userMessage, options);
      } catch (openAiError) {
        throw new AiServiceException('all providers', (openAiError as Error).message);
      }
    }

    // Store in cache
    if (options.cacheKey) {
      this.setInCache(options.cacheKey, response, options.cacheTtlSeconds ?? 3600);
    }

    return response;
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async callAnthropic(
    systemPrompt: string,
    userMessage: string,
    options: AiRequestOptions,
  ): Promise<AiResponse> {
    const model = this.config.get<string>('ANTHROPIC_MODEL', 'claude-opus-4-6');
    const maxTokens = options.maxTokens ?? 2048;

    const message = await this.anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const content = message.content[0].type === 'text' ? message.content[0].text : '';
    const tokensUsed = {
      input: message.usage.input_tokens,
      output: message.usage.output_tokens,
      total: message.usage.input_tokens + message.usage.output_tokens,
    };

    this.logger.debug(`Anthropic: ${tokensUsed.total} tokens used`);

    return { content, provider: 'anthropic', model, tokensUsed, fromCache: false };
  }

  private async callOpenAi(
    systemPrompt: string,
    userMessage: string,
    options: AiRequestOptions,
  ): Promise<AiResponse> {
    const model = this.config.get<string>('OPENAI_MODEL', 'gpt-4o');
    const maxTokens = options.maxTokens ?? 2048;

    const completion = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content ?? '{}';
    const usage = completion.usage;
    const tokensUsed = {
      input: usage?.prompt_tokens ?? 0,
      output: usage?.completion_tokens ?? 0,
      total: usage?.total_tokens ?? 0,
    };

    return { content, provider: 'openai', model, tokensUsed, fromCache: false };
  }

  private getFromCache(key: string): AiResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  private setInCache(key: string, value: AiResponse, ttlSeconds: number): void {
    this.cache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

// MIT Licence — AI CFO Wallet — Buypath Ltd
// Stripe service — handles card deposits and Stripe Connect integration

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentFailedException } from '../../common/exceptions/business.exception';
import type { StripeDepositIntent } from './payment.types';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(private readonly config: ConfigService) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY', 'sk_test_placeholder'), {
      apiVersion: '2024-12-18.acacia',
    });
  }

  /**
   * Creates a Stripe PaymentIntent for fiat deposits via card.
   * Returns a client secret for the frontend to complete the payment.
   */
  async createDepositIntent(
    businessId: string,
    amountPence: number,
    currency: string,
    idempotencyKey: string,
  ): Promise<StripeDepositIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount: amountPence,
          currency: currency.toLowerCase(),
          metadata: { businessId },
          description: `AI CFO Wallet deposit — ${businessId}`,
          automatic_payment_methods: { enabled: true },
        },
        { idempotencyKey },
      );

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret ?? '',
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error) {
      throw new PaymentFailedException((error as Error).message, 'Stripe');
    }
  }

  /**
   * Handles incoming Stripe webhooks — updates transaction status on payment events.
   * MUST verify the signature before processing.
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<{ type: string; paymentIntentId: string; status: string } | null> {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      this.logger.error(`Stripe webhook signature verification failed: ${(error as Error).message}`);
      return null;
    }

    this.logger.debug(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        return { type: 'succeeded', paymentIntentId: pi.id, status: 'completed' };
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        return { type: 'failed', paymentIntentId: pi.id, status: 'failed' };
      }
      default:
        return null;
    }
  }

  /**
   * Creates a Stripe Connect account for a business (for embedded card acceptance).
   */
  async createConnectAccount(email: string, businessId: string): Promise<string> {
    const account = await this.stripe.accounts.create({
      type: 'express',
      email,
      metadata: { businessId },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    return account.id;
  }

  /**
   * Generates a Stripe Connect onboarding link.
   */
  async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<string> {
    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return link.url;
  }
}

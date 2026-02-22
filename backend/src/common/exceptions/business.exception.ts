// MIT Licence — AI CFO Wallet — Buypath Ltd
// Custom exception classes for domain-specific errors

import { HttpException, HttpStatus } from '@nestjs/common';

export class BusinessNotFoundException extends HttpException {
  constructor(id: string) {
    super(`Business with ID '${id}' not found`, HttpStatus.NOT_FOUND);
  }
}

export class WalletNotFoundException extends HttpException {
  constructor(id: string) {
    super(`Wallet with ID '${id}' not found`, HttpStatus.NOT_FOUND);
  }
}

export class InsufficientFundsException extends HttpException {
  constructor(required: string, available: string, currency: string) {
    super(
      `Insufficient funds: required ${required} ${currency}, available ${available} ${currency}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class RuleNotFoundException extends HttpException {
  constructor(id: string) {
    super(`Rule with ID '${id}' not found`, HttpStatus.NOT_FOUND);
  }
}

export class RuleParsingException extends HttpException {
  constructor(message: string) {
    super(`Failed to parse rule: ${message}`, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class PaymentFailedException extends HttpException {
  constructor(message: string, provider?: string) {
    super(
      `Payment failed${provider ? ` (${provider})` : ''}: ${message}`,
      HttpStatus.BAD_GATEWAY,
    );
  }
}

export class SmartAccountException extends HttpException {
  constructor(message: string) {
    super(`Smart account error: ${message}`, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class KycNotApprovedException extends HttpException {
  constructor() {
    super('Business KYC verification is required before processing payments', HttpStatus.FORBIDDEN);
  }
}

export class PermissionDeniedException extends HttpException {
  constructor(action: string) {
    super(`Permission denied: you are not authorised to ${action}`, HttpStatus.FORBIDDEN);
  }
}

export class DuplicatePaymentException extends HttpException {
  constructor(idempotencyKey: string) {
    super(`Duplicate payment detected for key: ${idempotencyKey}`, HttpStatus.CONFLICT);
  }
}

export class AiServiceException extends HttpException {
  constructor(service: string, message: string) {
    super(`AI service error (${service}): ${message}`, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

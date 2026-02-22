// MIT Licence — AI CFO Wallet — Buypath Ltd
// Global HTTP exception filter — standardises error response format

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const message =
      typeof exceptionResponse === 'object' && 'message' in exceptionResponse
        ? (exceptionResponse as { message: string | string[] }).message
        : exception.message;

    const errorName =
      typeof exceptionResponse === 'object' && 'error' in exceptionResponse
        ? (exceptionResponse as { error: string }).error
        : HttpStatus[status];

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error: errorName,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} — ${status}: ${JSON.stringify(message)}`,
        exception.stack,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} — ${status}: ${JSON.stringify(message)}`);
    }

    response.status(status).json(errorResponse);
  }
}

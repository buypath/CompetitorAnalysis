// MIT Licence — AI CFO Wallet — Buypath Ltd
// Application entry point

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);

  // Global prefix and versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // CORS
  app.enableCors({
    origin: config.get('FRONTEND_URL', 'http://localhost:3001'),
    credentials: true,
  });

  // Global validation pipe — strict mode
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger / OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI CFO Wallet API')
    .setDescription(
      'Programmable treasury and payment layer for modern SMEs. ' +
      'Combines fiat + stablecoin wallets, smart account automation, and AI-powered cashflow intelligence.',
    )
    .setVersion('1.0')
    .setContact('Buypath Ltd', 'https://buypath.co.uk', 'support@buypath.co.uk')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Key' }, 'ApiKey')
    .addTag('auth', 'Authentication and authorisation')
    .addTag('business', 'Business profile and KYC')
    .addTag('wallets', 'Wallet management and balances')
    .addTag('transactions', 'Transaction history and details')
    .addTag('rules', 'Rules engine — create and manage treasury automation rules')
    .addTag('payments', 'Payment orchestration — fiat, stablecoin, and batch')
    .addTag('suppliers', 'Supplier and contractor management')
    .addTag('ai-cfo', 'AI CFO layer — forecasts, tax estimates, treasury recommendations')
    .addTag('accounting', 'Accounting integration and CSV exports')
    .addTag('smart-accounts', 'ERC-4337 smart account management')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`AI CFO Wallet API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap().catch(console.error);

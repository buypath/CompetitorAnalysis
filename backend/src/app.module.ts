// MIT Licence — AI CFO Wallet — Buypath Ltd
// Root application module

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './common/prisma/prisma.module';
import { SmartAccountModule } from './modules/smart-account/smart-account.module';
import { RulesEngineModule } from './modules/rules-engine/rules-engine.module';
import { PaymentModule } from './modules/payment/payment.module';
import { AiCfoModule } from './modules/ai-cfo/ai-cfo.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessModule } from './modules/business/business.module';

@Module({
  imports: [
    // Config — loads .env and validates
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: config.get<number>('RATE_LIMIT_TTL', 60) * 1000,
        limit: config.get<number>('RATE_LIMIT_MAX_GROWTH', 200),
      }]),
    }),

    // Cron scheduling
    ScheduleModule.forRoot(),

    // BullMQ queues (Redis-backed)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          tls: config.get<boolean>('REDIS_TLS', false) ? {} : undefined,
        },
      }),
    }),

    PrismaModule,
    AuthModule,
    BusinessModule,
    SmartAccountModule,
    RulesEngineModule,
    PaymentModule,
    AiCfoModule,
    AccountingModule,
  ],
})
export class AppModule {}

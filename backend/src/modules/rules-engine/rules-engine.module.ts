// MIT Licence — AI CFO Wallet — Buypath Ltd

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RulesEngineController } from './rules-engine.controller';
import { RuleParserService } from './rule-parser.service';
import { RuleValidatorService } from './rule-validator.service';
import { RuleExecutorService } from './rule-executor.service';
import { RuleSchedulerService } from './rule-scheduler.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'rule-execution' }),
  ],
  controllers: [RulesEngineController],
  providers: [
    RuleParserService,
    RuleValidatorService,
    RuleExecutorService,
    RuleSchedulerService,
  ],
  exports: [RuleParserService, RuleExecutorService],
})
export class RulesEngineModule {}

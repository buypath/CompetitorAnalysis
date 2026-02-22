// MIT Licence — AI CFO Wallet — Buypath Ltd
// Rules Engine controller — CRUD, activate/pause, and template endpoints

import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RuleParserService } from './rule-parser.service';
import { RuleValidatorService } from './rule-validator.service';
import { RuleSchedulerService } from './rule-scheduler.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RULE_TEMPLATES } from './rules-engine.types';
import { RuleNotFoundException } from '../../common/exceptions/business.exception';

@ApiTags('rules')
@ApiBearerAuth('JWT')
@Controller({ path: 'rules', version: '1' })
export class RulesEngineController {
  constructor(
    private readonly parser: RuleParserService,
    private readonly validator: RuleValidatorService,
    private readonly scheduler: RuleSchedulerService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('parse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Parse a natural language rule into structured JSON (preview, no save)' })
  @ApiResponse({ status: 200, description: 'Parsed rule logic returned' })
  async parseRule(
    @Body() body: { businessId: string; naturalLanguage: string },
  ) {
    const context = await this.validator.buildBusinessContext(body.businessId);
    const parsedLogic = await this.parser.parseNaturalLanguageRule(body.naturalLanguage, context);
    return { parsedLogic, preview: true };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new rule (parse, validate, and save as DRAFT)' })
  @ApiResponse({ status: 201, description: 'Rule created in DRAFT status' })
  async createRule(
    @Body() body: {
      businessId: string;
      naturalLanguage: string;
      name?: string;
    },
  ) {
    const context = await this.validator.buildBusinessContext(body.businessId);
    const parsedLogic = await this.parser.parseNaturalLanguageRule(body.naturalLanguage, context);
    await this.validator.validate(parsedLogic, context);

    const rule = await this.prisma.rule.create({
      data: {
        businessId: body.businessId,
        name: body.name ?? parsedLogic.name,
        naturalLanguageInput: body.naturalLanguage,
        parsedLogic: parsedLogic as never,
        status: 'DRAFT',
        triggerType: parsedLogic.triggerType,
        cronExpression: parsedLogic.cronExpression,
        thresholdConfig: parsedLogic.condition as never ?? null,
      },
    });

    return rule;
  }

  @Get()
  @ApiOperation({ summary: 'List all rules for a business' })
  @ApiQuery({ name: 'businessId', required: true })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'] })
  async listRules(
    @Query('businessId') businessId: string,
    @Query('status') status?: string,
  ) {
    return this.prisma.rule.findMany({
      where: {
        businessId,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        _count: { select: { executionLogs: true, scheduledPayments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('templates')
  @ApiOperation({ summary: 'List all pre-built rule templates' })
  async listTemplates() {
    return RULE_TEMPLATES;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a rule by ID including execution history' })
  async getRule(@Param('id') id: string) {
    const rule = await this.prisma.rule.findUnique({
      where: { id },
      include: {
        executionLogs: { orderBy: { executedAt: 'desc' }, take: 20 },
        scheduledPayments: { orderBy: { dueDate: 'asc' }, take: 10 },
      },
    });
    if (!rule) throw new RuleNotFoundException(id);
    return rule;
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a rule (moves from DRAFT or PAUSED to ACTIVE)' })
  async activateRule(@Param('id') id: string) {
    const rule = await this.prisma.rule.findUnique({ where: { id } });
    if (!rule) throw new RuleNotFoundException(id);
    await this.scheduler.activateRule(id);
    return { success: true, status: 'ACTIVE' };
  }

  @Patch(':id/pause')
  @ApiOperation({ summary: 'Pause a rule (stops future executions)' })
  async pauseRule(@Param('id') id: string) {
    const rule = await this.prisma.rule.findUnique({ where: { id } });
    if (!rule) throw new RuleNotFoundException(id);
    await this.scheduler.pauseRule(id);
    return { success: true, status: 'PAUSED' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archive a rule (soft delete)' })
  async archiveRule(@Param('id') id: string) {
    const rule = await this.prisma.rule.findUnique({ where: { id } });
    if (!rule) throw new RuleNotFoundException(id);
    await this.prisma.rule.update({ where: { id }, data: { status: 'ARCHIVED' } });
    return { success: true };
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get execution history for a rule' })
  async getRuleHistory(@Param('id') id: string, @Query('limit') limit = 50) {
    return this.prisma.ruleExecutionLog.findMany({
      where: { ruleId: id },
      orderBy: { executedAt: 'desc' },
      take: Number(limit),
    });
  }

  @Post('from-template/:templateId')
  @ApiOperation({ summary: 'Create a rule from a pre-built template' })
  async createFromTemplate(
    @Param('templateId') templateId: string,
    @Body() body: { businessId: string; customisations?: Record<string, unknown> },
  ) {
    const template = RULE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) throw new RuleNotFoundException(templateId);

    const context = await this.validator.buildBusinessContext(body.businessId);
    const parsedLogic = await this.parser.parseNaturalLanguageRule(template.naturalLanguage, context);

    return this.prisma.rule.create({
      data: {
        businessId: body.businessId,
        name: template.name,
        naturalLanguageInput: template.naturalLanguage,
        parsedLogic: parsedLogic as never,
        status: 'DRAFT',
        triggerType: template.triggerType,
        cronExpression: parsedLogic.cronExpression,
        metadata: { fromTemplate: templateId, ...(body.customisations ?? {}) },
      },
    });
  }
}

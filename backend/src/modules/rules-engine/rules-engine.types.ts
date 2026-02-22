// MIT Licence — AI CFO Wallet — Buypath Ltd
// Types for the Rules Engine module

export interface ParsedRule {
  trigger: 'schedule' | 'threshold' | 'event';
  name: string;
  description: string;
  schedule?: {
    cron: string;
    timezone: string;
  };
  condition?: {
    type: 'balance_exceeds' | 'balance_below' | 'percentage_of' | 'date_approaching';
    wallet: string;
    threshold: string | number;
    checkInterval: 'hourly' | 'daily' | 'weekly';
    operator: '>' | '<' | '>=' | '<=' | '==';
  };
  event?: {
    type: string;
    config: Record<string, unknown>;
  };
  action: {
    type: 'transfer' | 'convert' | 'convert_excess' | 'schedule_payment' | 'alert' | 'ring_fence';
    amount: string | number;
    from_wallet?: string;
    to_wallet?: string;
    from_currency?: string;
    to_currency?: string;
    description: string;
  };
  triggerType: 'SCHEDULE' | 'THRESHOLD' | 'EVENT';
  cronExpression: string | null;
}

export interface BusinessContext {
  businessId: string;
  currency: string;
  timezone: string;
  monthlyRevenue?: number;
  monthlyExpenses?: number;
  wallets: Array<{
    id: string;
    label: string;
    currency: string;
    balance: number;
    type: string;
  }>;
}

export interface RuleExecutionContext {
  ruleId: string;
  businessId: string;
  parsedLogic: ParsedRule;
  wallets: BusinessContext['wallets'];
  currentTime: Date;
}

export interface RuleExecutionResult {
  success: boolean;
  actionsPerformed: ActionRecord[];
  error?: string;
  durationMs: number;
}

export interface ActionRecord {
  type: string;
  amount?: number;
  currency?: string;
  fromWallet?: string;
  toWallet?: string;
  txId?: string;
  timestamp: Date;
}

// ─── Pre-built rule templates ─────────────────────────────────────────────────

export const RULE_TEMPLATES = [
  {
    id: 'vat_allocation',
    name: 'Weekly VAT Allocation',
    description: 'Move estimated VAT liability to a ring-fenced sub-wallet every Friday',
    naturalLanguage: 'Calculate estimated VAT liability from this week\'s revenue and move it to the VAT ring-fence wallet every Friday at 5pm',
    triggerType: 'SCHEDULE' as const,
    category: 'tax',
  },
  {
    id: 'pension_allocation',
    name: 'Monthly Pension Contribution',
    description: 'Allocate a percentage of net profit to the pension pot each month',
    naturalLanguage: 'Allocate 10% of monthly net profit to the pension wallet on the last working day of each month',
    triggerType: 'SCHEDULE' as const,
    category: 'savings',
  },
  {
    id: 'supplier_autopay',
    name: 'Supplier Auto-Pay',
    description: 'Automatically pay suppliers 7 days before their invoice due date',
    naturalLanguage: 'Pay all active suppliers 7 days before their invoice due date using their preferred payment method',
    triggerType: 'EVENT' as const,
    category: 'payments',
  },
  {
    id: 'fx_conversion_threshold',
    name: 'FX Conversion Threshold',
    description: 'Convert excess GBP to USDC when balance exceeds operating reserve',
    naturalLanguage: 'Keep 3 months of operating expenses in GBP and convert anything above that to USDC automatically',
    triggerType: 'THRESHOLD' as const,
    category: 'treasury',
  },
  {
    id: 'balance_alert',
    name: 'Low Balance Alert',
    description: 'Alert when GBP balance drops below 1 month of operating expenses',
    naturalLanguage: 'Send me an alert when my GBP balance falls below 1 month of average operating expenses',
    triggerType: 'THRESHOLD' as const,
    category: 'alerts',
  },
  {
    id: 'payroll_scheduling',
    name: 'Monthly Payroll',
    description: 'Schedule payroll payments for staff and contractors on a set date',
    naturalLanguage: 'Run payroll on the 25th of every month — pay UK staff in GBP via Faster Payments and contractors in USDC',
    triggerType: 'SCHEDULE' as const,
    category: 'payroll',
  },
  {
    id: 'surplus_sweep',
    name: 'Surplus Sweep',
    description: 'Move surplus cash to the USDC treasury for yield at month end',
    naturalLanguage: 'At the end of each month, sweep any cash above the 3-month operating reserve into the USDC treasury',
    triggerType: 'SCHEDULE' as const,
    category: 'treasury',
  },
  {
    id: 'opex_reserve',
    name: 'OpEx Reserve Top-Up',
    description: 'Automatically top up the operating expense reserve from USDC if it falls low',
    naturalLanguage: 'If the GBP primary balance drops below 2 months of operating expenses, convert USDC to GBP to top it back up to 3 months',
    triggerType: 'THRESHOLD' as const,
    category: 'treasury',
  },
  {
    id: 'profit_distribution',
    name: 'Quarterly Profit Distribution',
    description: 'Distribute net profit at quarter end: tax reserve, pension, and owner dividend',
    naturalLanguage: 'At the end of each quarter, allocate 25% to corporation tax reserve, 10% to pension pot, and 65% available for dividend',
    triggerType: 'SCHEDULE' as const,
    category: 'tax',
  },
  {
    id: 'emergency_fund',
    name: 'Emergency Fund Top-Up',
    description: 'Maintain a minimum emergency fund balance at all times',
    naturalLanguage: 'Always maintain at least £10,000 in the emergency fund — top it up from the primary GBP account when it falls below this amount',
    triggerType: 'THRESHOLD' as const,
    category: 'savings',
  },
] as const;

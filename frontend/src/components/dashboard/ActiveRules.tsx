// MIT Licence — AI CFO Wallet — Buypath Ltd
// Active rules widget — shows running automation rules

'use client';

import { Zap, Calendar, Activity, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const STUB_RULES = [
  {
    id: '1',
    name: 'Weekly VAT Allocation',
    trigger: 'Every Friday 5pm',
    lastRun: '3 days ago',
    status: 'active',
    executions: 12,
  },
  {
    id: '2',
    name: 'OpEx Reserve',
    trigger: 'Balance threshold',
    lastRun: '2 hours ago',
    status: 'active',
    executions: 47,
  },
  {
    id: '3',
    name: 'Monthly Payroll',
    trigger: '25th of month',
    lastRun: '4 days ago',
    status: 'active',
    executions: 8,
  },
];

interface ActiveRulesProps {
  businessId: string;
}

export function ActiveRules({ businessId }: ActiveRulesProps) {
  void businessId;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white">Active Rules</h2>
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{STUB_RULES.length} running</span>
        </div>
        <Link href="/rules" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
          Manage →
        </Link>
      </div>

      <div className="space-y-2">
        {STUB_RULES.map((rule) => (
          <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">{rule.name}</p>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {rule.trigger}
                </span>
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {rule.executions}× run
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-zinc-500">{rule.lastRun}</p>
              <ChevronRight className="w-3 h-3 text-zinc-600 mt-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

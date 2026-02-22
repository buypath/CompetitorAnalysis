// MIT Licence — AI CFO Wallet — Buypath Ltd
// AI CFO insights panel — surface recommendations from the AI CFO layer

'use client';

import { Brain, AlertTriangle, TrendingUp, Info } from 'lucide-react';

const STUB_INSIGHTS = [
  {
    type: 'opportunity',
    icon: TrendingUp,
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    title: 'Idle cash detected',
    description: '£22k is sitting in your primary account above the 3-month OpEx reserve. Consider moving to USDC for yield.',
    action: 'Move to treasury',
  },
  {
    type: 'risk',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    title: 'VAT return due in 9 days',
    description: '£12,400 liability estimated for Q4. Your VAT ring-fence has £12,400. You\'re covered.',
    action: 'Review VAT',
  },
  {
    type: 'recommendation',
    icon: Info,
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    title: 'FX savings opportunity',
    description: 'Paying 3 contractors in GBP costs ~£420/month in FX fees. Switch to USDC to eliminate this.',
    action: 'Set up USDC payroll',
  },
];

interface AiInsightsProps {
  businessId: string;
}

export function AiInsights({ businessId }: AiInsightsProps) {
  void businessId;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-5">
        <Brain className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold text-white">AI CFO Insights</h2>
        <span className="ml-auto text-xs text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
          {STUB_INSIGHTS.length} new
        </span>
      </div>

      <div className="space-y-3">
        {STUB_INSIGHTS.map((insight, idx) => {
          const Icon = insight.icon;
          return (
            <div key={idx} className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-lg ${insight.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`w-4 h-4 ${insight.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white">{insight.title}</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{insight.description}</p>
                  <button className="mt-2 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                    {insight.action} →
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

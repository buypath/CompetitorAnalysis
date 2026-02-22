// MIT Licence — AI CFO Wallet — Buypath Ltd
// Balance overview cards — GBP, USDC, VAT reserve, total

'use client';

import { TrendingUp, TrendingDown, Shield, PoundSterling, Coins } from 'lucide-react';

interface BalanceCardsProps {
  businessId: string;
}

// Stub data — replace with SWR hook fetching /api/v1/business/:id/wallets
const STUB_BALANCES = [
  {
    label: 'GBP Primary',
    amount: 85000.00,
    currency: 'GBP',
    change: +12.4,
    changeLabel: 'vs last month',
    icon: PoundSterling,
    iconColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  {
    label: 'USDC Treasury',
    amount: 25000.00,
    currency: 'USDC',
    change: +3.2,
    changeLabel: 'vs last month',
    icon: Coins,
    iconColor: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
  },
  {
    label: 'VAT Reserve',
    amount: 12400.00,
    currency: 'GBP',
    change: +8.1,
    changeLabel: 'this quarter',
    icon: Shield,
    iconColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  {
    label: 'Total Balance',
    amount: 122600.00,
    currency: 'GBP equiv.',
    change: +9.7,
    changeLabel: 'vs last month',
    icon: TrendingUp,
    iconColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
];

export function BalanceCards({ businessId }: BalanceCardsProps) {
  void businessId;

  return (
    <div className="grid grid-cols-4 gap-4">
      {STUB_BALANCES.map((card) => {
        const Icon = card.icon;
        const isPositive = card.change >= 0;
        const TrendIcon = isPositive ? TrendingUp : TrendingDown;

        return (
          <div
            key={card.label}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                  {card.currency === 'USDC' ? '$' : '£'}
                  {card.amount.toLocaleString('en-GB', { minimumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">{card.currency}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>

            <div className={`flex items-center gap-1 mt-3 text-xs ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              <TrendIcon className="w-3 h-3" />
              <span>{isPositive ? '+' : ''}{card.change}%</span>
              <span className="text-zinc-500">{card.changeLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

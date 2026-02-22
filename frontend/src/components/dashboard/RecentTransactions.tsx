// MIT Licence — AI CFO Wallet — Buypath Ltd

'use client';

import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';

const STUB_TRANSACTIONS = [
  { id: '1', type: 'DEPOSIT', description: 'Stripe — Client payment (Nov invoice)', amount: 8500, currency: 'GBP', date: 'Today, 09:14', status: 'COMPLETED' },
  { id: '2', type: 'PAYMENT', description: 'CloudHost Pro Ltd — Nov invoice', amount: -1200, currency: 'GBP', date: 'Today, 08:00', status: 'COMPLETED' },
  { id: '3', type: 'TRANSFER', description: 'VAT ring-fence — weekly rule', amount: -3840, currency: 'GBP', date: 'Fri, 17:00', status: 'COMPLETED' },
  { id: '4', type: 'CONVERSION', description: 'Surplus sweep → USDC treasury', amount: -5000, currency: 'GBP', date: 'Fri, 17:05', status: 'COMPLETED' },
  { id: '5', type: 'PAYMENT', description: 'Maria Santos — contractor payout', amount: -800, currency: 'USDC', date: 'Thu, 12:00', status: 'COMPLETED' },
];

const typeConfig = {
  DEPOSIT: { icon: ArrowDownLeft, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  PAYMENT: { icon: ArrowUpRight, color: 'text-red-400', bg: 'bg-red-500/10' },
  TRANSFER: { icon: ArrowLeftRight, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  CONVERSION: { icon: RefreshCw, color: 'text-violet-400', bg: 'bg-violet-500/10' },
};

interface RecentTransactionsProps {
  businessId: string;
}

export function RecentTransactions({ businessId }: RecentTransactionsProps) {
  void businessId;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-white">Recent Transactions</h2>
        <Link href="/payments" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
          View all →
        </Link>
      </div>

      <div className="space-y-1">
        {STUB_TRANSACTIONS.map((tx) => {
          const config = typeConfig[tx.type as keyof typeof typeConfig] ?? typeConfig.PAYMENT;
          const Icon = config.icon;
          const isPositive = tx.amount > 0;

          return (
            <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b border-zinc-800/50 last:border-0">
              <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{tx.description}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{tx.date}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-zinc-100'}`}>
                  {isPositive ? '+' : ''}{tx.currency === 'USDC' ? '$' : '£'}{Math.abs(tx.amount).toLocaleString('en-GB')}
                </p>
                <p className="text-xs text-zinc-500">{tx.currency}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// MIT Licence — AI CFO Wallet — Buypath Ltd
// Dashboard page — balance overview, forecast chart, active rules, recent transactions

'use client';

import { BalanceCards } from '../../components/dashboard/BalanceCards';
import { CashflowChart } from '../../components/charts/CashflowChart';
import { ActiveRules } from '../../components/dashboard/ActiveRules';
import { RecentTransactions } from '../../components/dashboard/RecentTransactions';
import { AiInsights } from '../../components/dashboard/AiInsights';

const BUSINESS_ID = 'seed-business-001'; // Would come from auth context in production

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Good morning, Sarah. Here's your treasury overview.
        </p>
      </div>

      {/* Balance cards */}
      <BalanceCards businessId={BUSINESS_ID} />

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Cashflow forecast chart — spans 2 columns */}
        <div className="col-span-2">
          <CashflowChart businessId={BUSINESS_ID} />
        </div>

        {/* AI insights panel */}
        <div className="col-span-1">
          <AiInsights businessId={BUSINESS_ID} />
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-2 gap-6">
        <ActiveRules businessId={BUSINESS_ID} />
        <RecentTransactions businessId={BUSINESS_ID} />
      </div>
    </div>
  );
}

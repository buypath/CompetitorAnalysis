// MIT Licence — AI CFO Wallet — Buypath Ltd
// Payments page — scheduled, history, and batch payout upload

'use client';

import { useState } from 'react';
import { CreditCard, Clock, CheckCircle, XCircle, Upload, Plus, Filter } from 'lucide-react';

const TABS = ['scheduled', 'history', 'batch'] as const;
type Tab = typeof TABS[number];

const STUB_SCHEDULED = [
  { id: '1', description: 'CloudHost Pro — Dec invoice', amount: 1200, currency: 'GBP', dueDate: '1 Dec 2026', method: 'Faster Payments', supplier: 'CloudHost Pro Ltd' },
  { id: '2', description: 'Payroll — Dec (UK staff)', amount: 14500, currency: 'GBP', dueDate: '25 Dec 2026', method: 'Faster Payments', supplier: 'Payroll batch' },
  { id: '3', description: 'Maria Santos — Dec contractor', amount: 1600, currency: 'USDC', dueDate: '25 Dec 2026', method: 'USDC', supplier: 'Maria Santos' },
];

const STUB_HISTORY = [
  { id: '1', description: 'Stripe — client payment', amount: 8500, currency: 'GBP', date: '22 Feb 2026', status: 'COMPLETED', type: 'DEPOSIT' },
  { id: '2', description: 'CloudHost Pro — Nov invoice', amount: 1200, currency: 'GBP', date: '21 Feb 2026', status: 'COMPLETED', type: 'PAYMENT' },
  { id: '3', description: 'VAT ring-fence transfer', amount: 3840, currency: 'GBP', date: '21 Feb 2026', status: 'COMPLETED', type: 'TRANSFER' },
  { id: '4', description: 'Dev Crew Manila — contractor', amount: 2000, currency: 'USDC', date: '20 Feb 2026', status: 'COMPLETED', type: 'PAYMENT' },
  { id: '5', description: 'FX conversion — GBP → USDC', amount: 5000, currency: 'GBP', date: '18 Feb 2026', status: 'COMPLETED', type: 'CONVERSION' },
  { id: '6', description: 'Stripe — client payment', amount: 12000, currency: 'GBP', date: '15 Feb 2026', status: 'COMPLETED', type: 'DEPOSIT' },
];

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage scheduled and historical payments.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded-lg transition-colors">
            <Upload className="w-4 h-4" />
            Batch Upload
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            New Payment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg w-fit">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors capitalize ${
              activeTab === tab ? 'bg-zinc-700 text-white font-medium' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {tab === 'scheduled' ? `Scheduled (${STUB_SCHEDULED.length})` : tab === 'history' ? 'History' : 'Batch Payouts'}
          </button>
        ))}
      </div>

      {activeTab === 'scheduled' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Description', 'Supplier', 'Amount', 'Due Date', 'Method', 'Action'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STUB_SCHEDULED.map((payment) => (
                <tr key={payment.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-sm text-white">{payment.description}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-400">{payment.supplier}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm font-semibold text-white">
                      {payment.currency === 'USDC' ? '$' : '£'}{payment.amount.toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-500 ml-1">{payment.currency}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-400">{payment.dueDate}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      payment.method === 'USDC' ? 'text-violet-400 bg-violet-500/10' : 'text-blue-400 bg-blue-500/10'
                    }`}>
                      {payment.method}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button className="text-xs text-red-400 hover:text-red-300 transition-colors">Cancel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
            <p className="text-sm text-zinc-400">{STUB_HISTORY.length} transactions</p>
            <button className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100">
              <Filter className="w-3 h-3" /> Filter
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Description', 'Amount', 'Date', 'Status', 'Type'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-zinc-500 uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STUB_HISTORY.map((tx) => (
                <tr key={tx.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm text-white">{tx.description}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-sm font-semibold ${tx.type === 'DEPOSIT' ? 'text-emerald-400' : 'text-white'}`}>
                      {tx.type === 'DEPOSIT' ? '+' : '-'}{tx.currency === 'USDC' ? '$' : '£'}{tx.amount.toLocaleString()}
                    </span>
                    <span className="text-xs text-zinc-500 ml-1">{tx.currency}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-zinc-400">{tx.date}</td>
                  <td className="px-5 py-3.5">
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle className="w-3 h-3" /> Completed
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-zinc-500 capitalize">{tx.type.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'batch' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-zinc-500" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-2">Upload Batch Payout CSV</h3>
          <p className="text-xs text-zinc-400 max-w-sm mb-5">
            Upload a CSV with recipient names, amounts, currencies, and payment methods.
            We'll process fiat and USDC payouts in a single batch.
          </p>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
            <Upload className="w-4 h-4" /> Choose CSV file
          </button>
          <p className="text-xs text-zinc-500 mt-3">
            Download <button className="text-violet-400 underline">CSV template</button>
          </p>
        </div>
      )}
    </div>
  );
}

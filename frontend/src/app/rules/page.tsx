// MIT Licence — AI CFO Wallet — Buypath Ltd
// Rules management page

'use client';

import { useState } from 'react';
import { Plus, Zap, Play, Pause, Archive, Clock, Activity, ChevronDown } from 'lucide-react';

const STUB_RULES = [
  {
    id: '1', name: 'Weekly VAT Allocation', status: 'ACTIVE',
    naturalLanguage: 'Move VAT aside weekly — estimate liability and transfer to ring-fenced wallet every Friday',
    trigger: 'Schedule · Every Friday 5pm', executions: 12, lastRun: '3 days ago',
    category: 'tax',
  },
  {
    id: '2', name: 'OpEx Reserve', status: 'ACTIVE',
    naturalLanguage: 'Keep 3 months of operating expenses in GBP — convert any excess to USDC',
    trigger: 'Threshold · Balance > £30,000', executions: 47, lastRun: '2 hours ago',
    category: 'treasury',
  },
  {
    id: '3', name: 'Monthly Payroll', status: 'ACTIVE',
    naturalLanguage: 'Run payroll on 25th — UK staff via Faster Payments, contractors via USDC',
    trigger: 'Schedule · 25th of month', executions: 8, lastRun: '4 days ago',
    category: 'payroll',
  },
  {
    id: '4', name: 'Pension Allocation', status: 'PAUSED',
    naturalLanguage: 'Allocate 10% of net monthly profit to the pension pot on last working day',
    trigger: 'Schedule · Last day of month', executions: 3, lastRun: '32 days ago',
    category: 'savings',
  },
];

const TEMPLATES = [
  { id: 'vat_allocation', name: 'Weekly VAT Allocation', category: 'tax', description: 'Ring-fence VAT every Friday' },
  { id: 'pension_allocation', name: 'Monthly Pension', category: 'savings', description: 'Allocate % of profit to pension' },
  { id: 'fx_conversion_threshold', name: 'Surplus Sweep', category: 'treasury', description: 'Convert excess GBP to USDC' },
  { id: 'payroll_scheduling', name: 'Monthly Payroll', category: 'payroll', description: 'Automated payroll on set date' },
  { id: 'balance_alert', name: 'Low Balance Alert', category: 'alerts', description: 'Alert below 1 month OpEx' },
  { id: 'supplier_autopay', name: 'Supplier Auto-Pay', category: 'payments', description: 'Pay suppliers 7 days early' },
];

const categoryColours: Record<string, string> = {
  tax: 'text-amber-400 bg-amber-500/10',
  treasury: 'text-violet-400 bg-violet-500/10',
  payroll: 'text-blue-400 bg-blue-500/10',
  savings: 'text-emerald-400 bg-emerald-500/10',
  alerts: 'text-red-400 bg-red-500/10',
  payments: 'text-cyan-400 bg-cyan-500/10',
};

export default function RulesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [activeTab, setActiveTab] = useState<'rules' | 'templates'>('rules');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Rules Engine</h1>
          <p className="text-zinc-400 text-sm mt-1">Automate your treasury in plain English.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg w-fit">
        {(['rules', 'templates'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors capitalize ${
              activeTab === tab
                ? 'bg-zinc-700 text-white font-medium'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {tab === 'rules' ? `My Rules (${STUB_RULES.length})` : `Templates (${TEMPLATES.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'rules' && (
        <div className="space-y-3">
          {STUB_RULES.map((rule) => (
            <div key={rule.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${rule.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white">{rule.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${categoryColours[rule.category] ?? 'text-zinc-400 bg-zinc-800'}`}>
                        {rule.category}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 italic">"{rule.naturalLanguage}"</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-zinc-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{rule.trigger}</span>
                      <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{rule.executions} executions</span>
                      <span>Last run: {rule.lastRun}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {rule.status === 'ACTIVE' ? (
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
                      <Pause className="w-3 h-3" /> Pause
                    </button>
                  ) : (
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors">
                      <Play className="w-3 h-3" /> Activate
                    </button>
                  )}
                  <button className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors">
                    <Archive className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-3 gap-4">
          {TEMPLATES.map((template) => (
            <div key={template.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-violet-500/50 transition-colors cursor-pointer group">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${categoryColours[template.category] ?? 'text-zinc-400 bg-zinc-800'}`}>
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-white">{template.name}</h3>
              <p className="text-xs text-zinc-400 mt-1">{template.description}</p>
              <button className="mt-3 text-xs text-violet-400 group-hover:text-violet-300 transition-colors">
                Use template →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-semibold text-white mb-1">Create New Rule</h2>
            <p className="text-sm text-zinc-400 mb-5">Describe what you want in plain English. The AI CFO will parse it into executable logic.</p>

            <textarea
              value={naturalLanguageInput}
              onChange={(e) => setNaturalLanguageInput(e.target.value)}
              placeholder='e.g. "Move 20% of monthly revenue to the tax reserve on the last Friday of each month"'
              rows={4}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-none"
            />

            <div className="flex gap-3 mt-4">
              <button className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
                Parse &amp; Preview
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2.5 text-sm text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

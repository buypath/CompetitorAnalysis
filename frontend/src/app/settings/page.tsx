// MIT Licence — AI CFO Wallet — Buypath Ltd
// Settings page — team, permissions, and integrations

'use client';

import { useState } from 'react';
import { Users, Plug, Shield, Bell, ChevronRight, Check, Trash2 } from 'lucide-react';

const SETTINGS_TABS = ['team', 'integrations', 'security', 'notifications'] as const;
type SettingsTab = typeof SETTINGS_TABS[number];

const STUB_TEAM = [
  { id: '1', name: 'Sarah Mitchell', email: 'owner@acmedigital.co.uk', role: 'OWNER', lastActive: 'Now' },
  { id: '2', name: 'James Thornton', email: 'finance@acmedigital.co.uk', role: 'ADMIN', lastActive: '2 hours ago' },
  { id: '3', name: 'Emma Clarke', email: 'emma@acmedigital.co.uk', role: 'MEMBER', lastActive: '3 days ago' },
];

const STUB_INTEGRATIONS = [
  { id: 'stripe', name: 'Stripe', description: 'Card payments and Stripe Connect', connected: true, logo: '💳' },
  { id: 'xero', name: 'Xero', description: 'Accounting export (CSV)', connected: false, logo: '📊' },
  { id: 'quickbooks', name: 'QuickBooks', description: 'Accounting export (CSV)', connected: false, logo: '📒' },
  { id: 'open-banking', name: 'Open Banking', description: 'Connect your existing bank account', connected: true, logo: '🏦' },
  { id: 'circle', name: 'Circle (USDC)', description: 'Stablecoin on/off ramp', connected: true, logo: '🔵' },
];

const roleColours: Record<string, string> = {
  OWNER: 'text-violet-400 bg-violet-500/10',
  ADMIN: 'text-blue-400 bg-blue-500/10',
  MEMBER: 'text-zinc-400 bg-zinc-700',
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('team');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">Manage your team, integrations, and preferences.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-lg w-fit">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors capitalize flex items-center gap-1.5 ${
              activeTab === tab ? 'bg-zinc-700 text-white font-medium' : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {tab === 'team' && <Users className="w-3.5 h-3.5" />}
            {tab === 'integrations' && <Plug className="w-3.5 h-3.5" />}
            {tab === 'security' && <Shield className="w-3.5 h-3.5" />}
            {tab === 'notifications' && <Bell className="w-3.5 h-3.5" />}
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'team' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-zinc-400">{STUB_TEAM.length} team members</p>
            <button className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors">
              <Users className="w-4 h-4" /> Invite member
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {STUB_TEAM.map((member, idx) => (
              <div key={member.id} className={`flex items-center gap-4 px-5 py-4 ${idx < STUB_TEAM.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                <div className="w-9 h-9 rounded-full bg-violet-600/30 flex items-center justify-center text-sm font-medium text-violet-400">
                  {member.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{member.name}</p>
                  <p className="text-xs text-zinc-500">{member.email}</p>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full ${roleColours[member.role] ?? ''}`}>
                  {member.role}
                </span>
                <p className="text-xs text-zinc-500 w-24 text-right">{member.lastActive}</p>
                {member.role !== 'OWNER' && (
                  <button className="text-zinc-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="grid grid-cols-2 gap-4">
          {STUB_INTEGRATIONS.map((integration) => (
            <div key={integration.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{integration.logo}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{integration.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{integration.description}</p>
                  </div>
                </div>
                {integration.connected ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                    <Check className="w-3 h-3" /> Connected
                  </span>
                ) : (
                  <button className="text-xs text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 px-3 py-1 rounded-full transition-colors">
                    Connect
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          {[
            { label: 'Two-factor authentication', description: 'Require 2FA for all team members', enabled: false },
            { label: 'Multi-sig for large payments', description: 'Require 2-of-3 approval for payments above £10,000', enabled: true },
            { label: 'IP allowlist', description: 'Restrict API access to specific IP addresses', enabled: false },
            { label: 'Audit log retention', description: 'Keep full audit trail for 7 years (HMRC compliant)', enabled: true },
          ].map((setting) => (
            <div key={setting.label} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-white">{setting.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{setting.description}</p>
              </div>
              <button className={`w-11 h-6 rounded-full relative transition-colors ${setting.enabled ? 'bg-violet-600' : 'bg-zinc-700'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${setting.enabled ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          {[
            { label: 'Large payment alerts', description: 'Notify when any payment exceeds £5,000', email: true, push: true },
            { label: 'Rule execution failures', description: 'Alert when an automation rule fails to execute', email: true, push: false },
            { label: 'Low balance warnings', description: 'Warn when balance drops below 1 month OpEx', email: true, push: true },
            { label: 'Anomaly detection', description: 'Flag unusual transactions for review', email: true, push: true },
            { label: 'Weekly treasury summary', description: 'Summary email every Monday morning', email: true, push: false },
          ].map((notification) => (
            <div key={notification.label} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-white">{notification.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{notification.description}</p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <input type="checkbox" className="accent-violet-600" defaultChecked={notification.email} />
                  Email
                </label>
                <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <input type="checkbox" className="accent-violet-600" defaultChecked={notification.push} />
                  Push
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

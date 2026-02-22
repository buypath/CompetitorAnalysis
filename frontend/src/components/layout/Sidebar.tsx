// MIT Licence — AI CFO Wallet — Buypath Ltd
// Sidebar navigation component

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Zap,
  CreditCard,
  Users,
  Brain,
  BookOpen,
  Wallet,
  Settings,
  ChevronRight,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/rules', label: 'Rules Engine', icon: Zap },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/suppliers', label: 'Suppliers', icon: Users },
  { href: '/ai-cfo', label: 'AI CFO', icon: Brain },
  { href: '/accounting', label: 'Accounting', icon: BookOpen },
  { href: '/wallets', label: 'Wallets', icon: Wallet },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm text-white">AI CFO Wallet</p>
            <p className="text-xs text-zinc-500">Acme Digital Agency</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-violet-600/20 text-violet-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer — subscription info */}
      <div className="p-4 border-t border-zinc-800">
        <div className="px-3 py-2 rounded-lg bg-zinc-800">
          <p className="text-xs font-medium text-zinc-300">Growth Plan</p>
          <p className="text-xs text-zinc-500 mt-0.5">£99/month · Renews 1 Mar</p>
          <div className="mt-2 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full w-3/5" />
          </div>
          <p className="text-xs text-zinc-500 mt-1">60% of API quota used</p>
        </div>
      </div>
    </aside>
  );
}

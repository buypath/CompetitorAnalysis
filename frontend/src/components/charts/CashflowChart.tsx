// MIT Licence — AI CFO Wallet — Buypath Ltd
// 90-day cashflow forecast chart using Recharts

'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface CashflowChartProps {
  businessId: string;
}

// Generate 90 days of stub forecast data
function generateForecastData() {
  const data = [];
  let balance = 85000;
  const today = new Date();

  for (let i = 0; i < 90; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    // Simulate revenue and expenses
    const revenue = i % 30 < 5 ? Math.random() * 15000 + 5000 : Math.random() * 3000;
    const expenses = Math.random() * 8000 + 2000;
    balance = balance + revenue - expenses;

    data.push({
      date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      balance: Math.round(balance),
      low: Math.round(balance * 0.85),
      high: Math.round(balance * 1.15),
      isToday: i === 0,
    });
  }
  return data;
}

const data = generateForecastData();

const formatCurrency = (value: number) =>
  `£${(value / 1000).toFixed(0)}k`;

export function CashflowChart({ businessId }: CashflowChartProps) {
  void businessId;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-white">90-Day Cashflow Forecast</h2>
          <p className="text-xs text-zinc-500 mt-0.5">AI-generated · Updated 2 hours ago</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-violet-500 inline-block rounded" />
            Projected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-violet-500/30 inline-block rounded" />
            Confidence range
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#71717a', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={14}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fill: '#71717a', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#18181b',
              border: '1px solid #3f3f46',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#d4d4d8', marginBottom: '4px' }}
            formatter={(value: number, name: string) => [
              `£${value.toLocaleString('en-GB')}`,
              name === 'balance' ? 'Projected' : name === 'high' ? 'Upper bound' : 'Lower bound',
            ]}
          />
          {/* Confidence band */}
          <Area
            type="monotone"
            dataKey="high"
            stroke="transparent"
            fill="url(#rangeGradient)"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="low"
            stroke="transparent"
            fill="#18181b"
            fillOpacity={1}
          />
          {/* Main forecast line */}
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#7c3aed"
            strokeWidth={2}
            fill="url(#balanceGradient)"
          />
          {/* Today marker */}
          <ReferenceLine x={data[0]?.date} stroke="#7c3aed" strokeDasharray="3 3" label={{ value: 'Today', fill: '#7c3aed', fontSize: 11 }} />
          {/* 3-month opex reserve line */}
          <ReferenceLine y={30000} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: '3mo OpEx', fill: '#f59e0b', fontSize: 10, position: 'insideRight' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

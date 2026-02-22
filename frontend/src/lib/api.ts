// MIT Licence — AI CFO Wallet — Buypath Ltd
// API client — typed fetch wrapper for the backend REST API

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      // In production: include JWT from auth session
      // 'Authorization': `Bearer ${token}`,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message ?? 'API error');
  }

  return res.json() as Promise<T>;
}

// ─── Typed API methods ─────────────────────────────────────────────────────────

export const api = {
  business: {
    getWallets: (businessId: string) => apiFetch(`/business/${businessId}/wallets`),
    getSuppliers: (businessId: string) => apiFetch(`/business/${businessId}/suppliers`),
  },

  payments: {
    list: (businessId: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams({ businessId, ...params }).toString() : `?businessId=${businessId}`;
      return apiFetch(`/payments${qs}`);
    },
    listScheduled: (businessId: string) => apiFetch(`/payments/scheduled?businessId=${businessId}`),
  },

  rules: {
    list: (businessId: string) => apiFetch(`/rules?businessId=${businessId}`),
    templates: () => apiFetch('/rules/templates'),
    parse: (businessId: string, naturalLanguage: string) =>
      apiFetch('/rules/parse', {
        method: 'POST',
        body: JSON.stringify({ businessId, naturalLanguage }),
      }),
    create: (businessId: string, naturalLanguage: string) =>
      apiFetch('/rules', {
        method: 'POST',
        body: JSON.stringify({ businessId, naturalLanguage }),
      }),
    activate: (id: string) => apiFetch(`/rules/${id}/activate`, { method: 'PATCH' }),
    pause: (id: string) => apiFetch(`/rules/${id}/pause`, { method: 'PATCH' }),
  },

  aiCfo: {
    getCashflowForecast: (businessId: string, refresh = false) =>
      apiFetch(`/ai-cfo/forecast/cashflow?businessId=${businessId}&refresh=${refresh}`),
    getTaxEstimate: (businessId: string) => apiFetch(`/ai-cfo/tax/estimate?businessId=${businessId}`),
    getTreasuryAnalysis: (businessId: string) => apiFetch(`/ai-cfo/treasury/analysis?businessId=${businessId}`),
    getAnomalies: (businessId: string) => apiFetch(`/ai-cfo/anomalies?businessId=${businessId}`),
  },

  accounting: {
    categorise: (businessId: string) =>
      apiFetch(`/accounting/categorise?businessId=${businessId}`, { method: 'POST' }),
    exportXero: (businessId: string, from: string, to: string) =>
      `${API_BASE}/accounting/export/xero?businessId=${businessId}&from=${from}&to=${to}`,
    exportQuickBooks: (businessId: string, from: string, to: string) =>
      `${API_BASE}/accounting/export/quickbooks?businessId=${businessId}&from=${from}&to=${to}`,
  },
};

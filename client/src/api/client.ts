import type { Session, Note, Commit, TestRun, TestRunDetail, PortfolioData, Invoice, InvoicePreview, BiweeklyPeriod, TaxSummary } from '../types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  clockIn(): Promise<Session> {
    return request('/sessions/clock-in', { method: 'POST' });
  },

  clockOut(handoffNote?: string): Promise<Session> {
    return request('/sessions/clock-out', {
      method: 'POST',
      body: JSON.stringify({ handoffNote }),
    });
  },

  getLastHandoff(): Promise<{ handoff: string | null }> {
    return request('/sessions/last-handoff');
  },

  getCurrentSession(): Promise<Session | null> {
    return request('/sessions/current');
  },

  getSessions(): Promise<Session[]> {
    return request('/sessions');
  },

  getSession(id: number): Promise<Session> {
    return request(`/sessions/${id}`);
  },

  deleteSession(id: number): Promise<void> {
    return request(`/sessions/${id}`, { method: 'DELETE' });
  },

  getTestRuns(): Promise<TestRun[]> {
    return request('/test-runs');
  },

  getTestRunDetail(filename: string): Promise<TestRunDetail> {
    return request(`/test-runs/${encodeURIComponent(filename)}`);
  },

  addNote(content: string): Promise<Note> {
    return request('/notes', {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  getSessionCommits(): Promise<Commit[]> {
    return request('/sessions/current/commits');
  },

  updateCommitComment(id: number, comment: string): Promise<void> {
    return request(`/commits/${id}/comment`, {
      method: 'PATCH',
      body: JSON.stringify({ comment }),
    });
  },

  getPortfolio(): Promise<PortfolioData> {
    return request('/portfolio');
  },

  getPortfolioPdfUrl(): string {
    return `${BASE}/portfolio/pdf`;
  },

  getInvoices(): Promise<Invoice[]> {
    return request('/invoices');
  },

  getInvoicePeriods(): Promise<BiweeklyPeriod[]> {
    return request('/invoices/periods');
  },

  getInvoiceConfig(): Promise<Record<string, string>> {
    return request('/invoices/config');
  },

  updateInvoiceConfig(config: Record<string, string>): Promise<Record<string, string>> {
    return request('/invoices/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  previewInvoice(periodStart: string, periodEnd: string): Promise<InvoicePreview> {
    return request(`/invoices/preview?periodStart=${periodStart}&periodEnd=${periodEnd}`);
  },

  deleteInvoice(id: number): Promise<void> {
    return request(`/invoices/${id}`, { method: 'DELETE' });
  },

  getInvoicePdfUrl(id: number): string {
    return `${BASE}/invoices/${id}/pdf`;
  },

  updatePayment(id: number, paidAmount: number): Promise<Invoice> {
    return request(`/invoices/${id}/paid`, {
      method: 'PATCH',
      body: JSON.stringify({ paid_amount: paidAmount }),
    });
  },

  getTaxSummary(year: number): Promise<TaxSummary> {
    return request(`/invoices/tax-summary?year=${year}`);
  },
};

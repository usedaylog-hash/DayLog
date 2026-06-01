import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './client.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

function errorResponse(status: number, body?: { error?: string }) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body ?? {}),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('request wrapper', () => {
  it('sends Content-Type application/json header', async () => {
    mockFetch.mockResolvedValue(jsonResponse(null));
    await api.getCurrentSession();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/sessions/current',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('prepends /api to all request paths', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]));
    await api.getSessions();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/sessions');
  });

  it('throws with error message from response body', async () => {
    mockFetch.mockResolvedValue(errorResponse(400, { error: 'Already clocked in' }));
    await expect(api.clockIn()).rejects.toThrow('Already clocked in');
  });

  it('throws with status code when no error message in body', async () => {
    mockFetch.mockResolvedValue(errorResponse(500));
    await expect(api.getSessions()).rejects.toThrow('Request failed: 500');
  });

  it('handles non-JSON error responses gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    });
    await expect(api.getSessions()).rejects.toThrow('Request failed: 502');
  });
});

describe('session methods', () => {
  it('clockIn sends POST', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1 }));
    await api.clockIn();
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions/clock-in', expect.objectContaining({ method: 'POST' }));
  });

  it('clockOut sends POST with handoffNote in body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1 }));
    await api.clockOut('finish auth');
    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body)).toEqual({ handoffNote: 'finish auth' });
  });

  it('getLastHandoff calls correct path', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ handoff: null }));
    await api.getLastHandoff();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/sessions/last-handoff');
  });

  it('getSession includes ID in path', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 42 }));
    await api.getSession(42);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/sessions/42');
  });

  it('deleteSession sends DELETE', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));
    await api.deleteSession(5);
    expect(mockFetch).toHaveBeenCalledWith('/api/sessions/5', expect.objectContaining({ method: 'DELETE' }));
  });
});

describe('note and commit methods', () => {
  it('addNote sends POST with content', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1 }));
    await api.addNote('test note');
    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(call[1].body)).toEqual({ content: 'test note' });
  });

  it('updateCommitComment sends PATCH', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    await api.updateCommitComment(3, 'updated comment');
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('/api/commits/3/comment');
    expect(call[1].method).toBe('PATCH');
  });
});

describe('invoice methods', () => {
  it('getInvoices calls correct path', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]));
    await api.getInvoices();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/invoices');
  });

  it('getInvoicePeriods calls correct path', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]));
    await api.getInvoicePeriods();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/invoices/periods');
  });

  it('updateInvoiceConfig sends PUT with body', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    await api.updateInvoiceConfig({ hourly_rate: '25' });
    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe('PUT');
    expect(JSON.parse(call[1].body)).toEqual({ hourly_rate: '25' });
  });

  it('previewInvoice includes query params', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ items: [] }));
    await api.previewInvoice('2026-03-02', '2026-03-13');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/invoices/preview?periodStart=2026-03-02&periodEnd=2026-03-13');
  });

  it('deleteInvoice sends DELETE with ID', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));
    await api.deleteInvoice(7);
    expect(mockFetch).toHaveBeenCalledWith('/api/invoices/7', expect.objectContaining({ method: 'DELETE' }));
  });

  it('updatePayment sends PATCH with paid_amount', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ id: 1, paid_amount: 50 }));
    await api.updatePayment(1, 50);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('/api/invoices/1/paid');
    expect(call[1].method).toBe('PATCH');
    expect(JSON.parse(call[1].body)).toEqual({ paid_amount: 50 });
  });
});

describe('non-fetch helpers', () => {
  it('getPortfolioPdfUrl returns correct URL', () => {
    expect(api.getPortfolioPdfUrl()).toBe('/api/portfolio/pdf');
  });

  it('getInvoicePdfUrl returns correct URL with ID', () => {
    expect(api.getInvoicePdfUrl(42)).toBe('/api/invoices/42/pdf');
  });
});

describe('test run methods', () => {
  it('getTestRuns calls correct path', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]));
    await api.getTestRuns();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/test-runs');
  });

  it('getTestRunDetail encodes filename', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    await api.getTestRunDetail('regression-2026-03-10.txt');
    expect(mockFetch.mock.calls[0][0]).toBe('/api/test-runs/regression-2026-03-10.txt');
  });
});

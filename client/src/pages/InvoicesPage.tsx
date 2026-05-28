import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Invoice, InvoicePreview, BiweeklyPeriod } from '../types';
import { Toast } from '../components/Toast';
import styles from './InvoicesPage.module.css';

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [periods, setPeriods] = useState<BiweeklyPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([api.getInvoices(), api.getInvoicePeriods()])
      .then(([inv, per]) => {
        setInvoices(inv);
        setPeriods(per);
        if (per.length > 0) setSelectedPeriod(`${per[0].start}|${per[0].end}`);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handlePreview() {
    const [start, end] = selectedPeriod.split('|');
    setPreviewing(true);
    setPreview(null);
    try {
      const data = await api.previewInvoice(start, end);
      setPreview(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleGenerate() {
    const [start, end] = selectedPeriod.split('|');
    setGenerating(true);
    try {
      const res = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodStart: start, periodEnd: end }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to generate invoice');
      }
      // Download the PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="(.+)"/);
      a.download = filenameMatch ? filenameMatch[1] : 'invoice.pdf';
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);

      // Refresh invoice list
      const updated = await api.getInvoices();
      setInvoices(updated);
      setPreview(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const inv = invoices.find((i) => i.id === id);
      await api.deleteInvoice(id);
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      setConfirmDelete(null);
      setToast(`Invoice ${inv?.invoice_number ?? ''} deleted`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) return <p className={styles.message}>Loading invoices...</p>;
  if (error) return <p className={styles.message}>Error: {error}</p>;

  return (
    <div className="container">
      {toast && (
        <Toast message={toast} onDismiss={() => setToast('')} duration={3000} />
      )}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Generate New Invoice</h2>
        <div className={styles.controls}>
          <div className={styles.fieldGroup}>
            <label>Billing Period</label>
            <select
              value={selectedPeriod}
              onChange={(e) => { setSelectedPeriod(e.target.value); setPreview(null); }}
            >
              {periods.map((p) => (
                <option key={p.start} value={`${p.start}|${p.end}`}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handlePreview}
            disabled={previewing || !selectedPeriod}
          >
            {previewing ? 'Loading...' : 'Preview'}
          </button>
          {preview && preview.items.length > 0 && (
            <button
              className={`${styles.btn} ${styles.btnSuccess}`}
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? 'Generating...' : 'Generate Invoice'}
            </button>
          )}
        </div>

        {preview && (
          <div className={styles.tableScroll}>
            {preview.items.length === 0 ? (
              <p className={styles.empty}>No billable sessions found in this period.</p>
            ) : (
              <table className={styles.previewTable}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Location</th>
                    <th>Description</th>
                    <th>Hours</th>
                    <th>Rate</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.date}</td>
                      <td>{item.location}</td>
                      <td style={{ whiteSpace: 'pre-line' }}>{item.description}</td>
                      <td>{item.hours.toFixed(2)}</td>
                      <td>${item.rate.toFixed(2)}</td>
                      <td>${item.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className={styles.totalsRow}>
                    <td colSpan={3}>Total</td>
                    <td>{preview.totalHours.toFixed(2)}</td>
                    <td></td>
                    <td>${preview.totalAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Past Invoices</h2>
        {invoices.length === 0 ? (
          <p className={styles.empty}>No invoices generated yet.</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.invoiceTable}>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Date</th>
                  <th>Period</th>
                  <th>Hours</th>
                  <th>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoice_number}</td>
                    <td>{inv.invoice_date}</td>
                    <td>{inv.period_start} to {inv.period_end}</td>
                    <td>{inv.total_hours.toFixed(2)}</td>
                    <td>${inv.total_amount.toFixed(2)}</td>
                    <td className={styles.actions}>
                      <a
                        href={api.getInvoicePdfUrl(inv.id)}
                        className={styles.downloadLink}
                        download
                      >
                        Download
                      </a>
                      {confirmDelete === inv.id ? (
                        <span className={styles.confirmGroup}>
                          <span className={styles.confirmText}>Delete?</span>
                          <button className={styles.confirmYes} onClick={() => handleDelete(inv.id)}>Yes</button>
                          <button className={styles.confirmNo} onClick={() => setConfirmDelete(null)}>No</button>
                        </span>
                      ) : (
                        <button className={styles.deleteBtn} onClick={() => setConfirmDelete(inv.id)}>Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

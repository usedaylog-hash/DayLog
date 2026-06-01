import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Invoice, InvoicePreview, BiweeklyPeriod, TaxSummary } from '../types';
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
  const [confirmUnpaid, setConfirmUnpaid] = useState<number | null>(null);
  const [paymentInput, setPaymentInput] = useState<{ id: number; amount: string } | null>(null);
  const [toast, setToast] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);

  useEffect(() => {
    Promise.all([api.getInvoices(), api.getInvoicePeriods(), api.getInvoiceConfig(), api.getTaxSummary(new Date().getFullYear())])
      .then(([inv, per, cfg, tax]) => {
        setInvoices(inv);
        setPeriods(per);
        setConfig(cfg);
        setTaxSummary(tax);
        if (per.length > 0) setSelectedPeriod(`${per[0].start}|${per[0].end}`);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.getTaxSummary(taxYear).then(setTaxSummary).catch(() => {});
  }, [taxYear]);

  async function handlePreview() {
    const [start, end] = selectedPeriod.split('|');
    setPreviewing(true);
    setPreview(null);
    try {
      const data = await api.previewInvoice(start, end);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoice');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete invoice');
    }
  }

  async function handleUpdatePayment(id: number, amount: number) {
    try {
      const updated = await api.updatePayment(id, amount);
      setInvoices((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setPaymentInput(null);
      setConfirmUnpaid(null);
      // Refresh tax summary
      api.getTaxSummary(taxYear).then(setTaxSummary).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update payment');
    }
  }

  function openPaymentInput(inv: Invoice) {
    setPaymentInput({ id: inv.id, amount: inv.total_amount.toFixed(2) });
  }

  function updateConfig(key: string, value: string) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      const updated = await api.updateInvoiceConfig(config);
      setConfig(updated);
      setToast('Settings saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSavingConfig(false);
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
                  <th>Status</th>
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
                    <td>
                      {paymentInput?.id === inv.id ? (
                        <span className={styles.paymentInputGroup}>
                          <span className={styles.inputPrefix}>$</span>
                          <input
                            type="number"
                            className={styles.paymentAmountInput}
                            value={paymentInput.amount}
                            onChange={(e) => setPaymentInput({ ...paymentInput, amount: e.target.value })}
                            min="0"
                            max={inv.total_amount}
                            step="0.01"
                            autoFocus
                          />
                          <button className={styles.confirmYes} onClick={() => handleUpdatePayment(inv.id, parseFloat(paymentInput.amount) || 0)}>Save</button>
                          <button className={styles.confirmNo} onClick={() => setPaymentInput(null)}>Cancel</button>
                        </span>
                      ) : inv.paid_amount >= inv.total_amount ? (
                        confirmUnpaid === inv.id ? (
                          <span className={styles.confirmGroup}>
                            <span className={styles.confirmText}>Mark unpaid?</span>
                            <button className={styles.confirmYes} onClick={() => handleUpdatePayment(inv.id, 0)}>Yes</button>
                            <button className={styles.confirmNo} onClick={() => setConfirmUnpaid(null)}>No</button>
                          </span>
                        ) : (
                          <button className={styles.badgePaid} onClick={() => setConfirmUnpaid(inv.id)}>
                            Paid {inv.paid_date}
                          </button>
                        )
                      ) : inv.paid_amount > 0 ? (
                        <button className={styles.badgePartial} onClick={() => openPaymentInput(inv)}
                          title={`$${inv.paid_amount.toFixed(2)} of $${inv.total_amount.toFixed(2)} paid — $${(inv.total_amount - inv.paid_amount).toFixed(2)} remaining`}
                        >
                          Partial ${inv.paid_amount.toFixed(0)}/${inv.total_amount.toFixed(0)}
                        </button>
                      ) : (
                        <button className={styles.badgeUnpaid} onClick={() => openPaymentInput(inv)}>
                          Unpaid
                        </button>
                      )}
                    </td>
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

      {taxSummary && (
        <div className={styles.section}>
          <div className={styles.taxHeader}>
            <h2 className={styles.sectionTitle}>Tax Overview</h2>
            <select
              className={styles.yearSelect}
              value={taxYear}
              onChange={(e) => setTaxYear(parseInt(e.target.value))}
            >
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
            </select>
          </div>

          <div className={styles.taxStatsGrid}>
            <div className={styles.taxStatCard}>
              <div className={styles.taxStatValue}>${taxSummary.ytd.earned.toFixed(2)}</div>
              <div className={styles.taxStatLabel}>YTD Earned</div>
            </div>
            <div className={styles.taxStatCard}>
              <div className={styles.taxStatValue}>${taxSummary.ytd.estimatedTax.toFixed(2)}</div>
              <div className={styles.taxStatLabel}>YTD Est. Tax</div>
            </div>
            <div className={styles.taxStatCard}>
              <div className={styles.taxStatValue}>${taxSummary.ytd.unpaid.toFixed(2)}</div>
              <div className={styles.taxStatLabel}>Outstanding</div>
            </div>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.invoiceTable}>
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th>Hours</th>
                  <th>Earned</th>
                  <th>Paid</th>
                  <th>Unpaid</th>
                  <th>Est. Tax</th>
                </tr>
              </thead>
              <tbody>
                {taxSummary.quarters.map((q) => (
                  <tr key={q.quarter}>
                    <td>{q.label}</td>
                    <td>{q.hours.toFixed(2)}</td>
                    <td>${q.earned.toFixed(2)}</td>
                    <td>${q.paid.toFixed(2)}</td>
                    <td>${q.unpaid.toFixed(2)}</td>
                    <td>${q.estimatedTax.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={styles.taxNote}>
            Tax estimate uses {taxSummary.taxRate}% (self-employment + federal income). Adjust in settings.
          </p>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Invoice Settings</h2>
        <div className={styles.settingsGrid}>
          <div className={styles.settingsColumn}>
            <h3 className={styles.settingsSubtitle}>Contractor Info</h3>
            <label className={styles.settingsLabel}>
              Name
              <input type="text" value={config.contractor_name ?? ''} onChange={(e) => updateConfig('contractor_name', e.target.value)} />
            </label>
            <label className={styles.settingsLabel}>
              Address
              <input type="text" value={config.contractor_address ?? ''} onChange={(e) => updateConfig('contractor_address', e.target.value)} />
            </label>
            <label className={styles.settingsLabel}>
              City / State / ZIP
              <input type="text" value={config.contractor_city_state_zip ?? ''} onChange={(e) => updateConfig('contractor_city_state_zip', e.target.value)} />
            </label>
            <label className={styles.settingsLabel}>
              UBI
              <input type="text" value={config.contractor_ubi ?? ''} onChange={(e) => updateConfig('contractor_ubi', e.target.value)} />
            </label>
            <label className={styles.settingsLabel}>
              Tax ID (last 4)
              <input type="text" value={config.contractor_tax_id_last4 ?? ''} onChange={(e) => updateConfig('contractor_tax_id_last4', e.target.value)} />
            </label>
            <label className={styles.settingsLabel}>
              Phone
              <input type="text" value={config.contractor_phone ?? ''} onChange={(e) => updateConfig('contractor_phone', e.target.value)} />
            </label>
            <label className={styles.settingsLabel}>
              Email
              <input type="text" value={config.contractor_email ?? ''} onChange={(e) => updateConfig('contractor_email', e.target.value)} />
            </label>
          </div>

          <div className={styles.settingsColumn}>
            <h3 className={styles.settingsSubtitle}>Client Info</h3>
            <label className={styles.settingsLabel}>
              Contact Name
              <input type="text" value={config.client_name ?? ''} onChange={(e) => updateConfig('client_name', e.target.value)} />
            </label>
            <label className={styles.settingsLabel}>
              Company
              <input type="text" value={config.client_company ?? ''} onChange={(e) => updateConfig('client_company', e.target.value)} />
            </label>
            <label className={styles.settingsLabel}>
              Address
              <input type="text" value={config.client_address ?? ''} onChange={(e) => updateConfig('client_address', e.target.value)} />
            </label>
            <label className={styles.settingsLabel}>
              City / State / ZIP
              <input type="text" value={config.client_city_state_zip ?? ''} onChange={(e) => updateConfig('client_city_state_zip', e.target.value)} />
            </label>

            <h3 className={styles.settingsSubtitle}>Rates</h3>
            <label className={styles.settingsLabel}>
              Hourly Rate
              <div className={styles.inputWithAffix}>
                <span className={styles.inputPrefix}>$</span>
                <input type="text" value={config.hourly_rate ?? ''} onChange={(e) => updateConfig('hourly_rate', e.target.value)} />
              </div>
            </label>
            <label className={styles.settingsLabel}>
              Tax Rate
              <div className={styles.inputWithAffix}>
                <input type="text" value={config.tax_rate ?? ''} onChange={(e) => updateConfig('tax_rate', e.target.value)} />
                <span className={styles.inputSuffix}>%</span>
              </div>
            </label>
          </div>
        </div>
        <button
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={handleSaveConfig}
          disabled={savingConfig}
        >
          {savingConfig ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

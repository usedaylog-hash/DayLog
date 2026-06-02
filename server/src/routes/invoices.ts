import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';
import { db } from '../db/connection.js';
import { getBiweeklyPeriods, formatTime, roundToHalfHour, DAY_MS } from '../utils/invoice-utils.js';
import type { LineItem } from '../utils/invoice-utils.js';

const router = Router();

interface InvoiceRow {
  id: number;
  invoice_number: string;
  invoice_date: string;
  period_start: string;
  period_end: string;
  hourly_rate: number;
  total_hours: number;
  total_amount: number;
  created_at: string;
  paid_date: string | null;
  paid_amount: number;
}

interface SessionRow {
  id: number;
  clock_in: string;
  clock_out: string;
}

function getLineItems(periodStart: string, periodEnd: string, hourlyRate: number): LineItem[] {
  // End date is the Friday itself, so include sessions on that day (< end + 1 day)
  const endPlusOne = new Date(new Date(periodEnd).getTime() + DAY_MS).toISOString().split('T')[0];
  const sessions = db.prepare(
    `SELECT id, clock_in, clock_out, summary FROM sessions
     WHERE clock_in >= ? AND clock_in < ? AND clock_out IS NOT NULL
     ORDER BY clock_in`
  ).all(periodStart, endPlusOne) as (SessionRow & { summary: string | null })[];

  const items: LineItem[] = [];

  for (const session of sessions) {
    const clockIn = roundToHalfHour(new Date(session.clock_in));
    const clockOut = roundToHalfHour(new Date(session.clock_out));
    const ms = clockOut.getTime() - clockIn.getTime();
    const sessionHours = Math.round((ms / 3_600_000) * 100) / 100;
    const dateStr = session.clock_in.split('T')[0];
    const timeRange = `${formatTime(session.clock_in)} – ${formatTime(session.clock_out)}`;

    // Extract work items from summary, filtering noise
    const workItems: string[] = [];
    if (session.summary) {
      for (const line of session.summary.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('Session:')) continue;
        if (/^\d+ commits?$/.test(trimmed)) continue;
        // Strip git hash prefix if present
        const commitMatch = trimmed.match(/^[a-f0-9]{7}\s+(.+)/);
        const text = commitMatch ? commitMatch[1] : trimmed;
        // Filter out noisy/housekeeping commits
        if (/^Update CLAUDE\.md/i.test(text)) continue;
        if (/^Update reports/i.test(text)) continue;
        workItems.push(text);
      }
    }

    // Limit to 3 work items to keep rows concise
    const maxItems = 3;
    let descLines: string;
    if (workItems.length > maxItems) {
      const shown = workItems.slice(0, maxItems).join('\n');
      descLines = `${timeRange}\n${shown}\n+ ${workItems.length - maxItems} more`;
    } else if (workItems.length > 0) {
      descLines = `${timeRange}\n${workItems.join('\n')}`;
    } else {
      descLines = `${timeRange}: Development work`;
    }

    const description = descLines;

    items.push({
      date: dateStr,
      location: 'Remote',
      description,
      hours: sessionHours,
      rate: hourlyRate,
      amount: Math.round(sessionHours * hourlyRate * 100) / 100,
    });
  }

  return items;
}

function getConfig(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM invoice_config').all() as Array<{ key: string; value: string }>;
  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.value;
  }
  return config;
}

function getNextInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const row = db.prepare(
    `SELECT invoice_number FROM invoices
     WHERE invoice_number LIKE ?
     ORDER BY invoice_number DESC LIMIT 1`
  ).get(`${prefix}%`) as { invoice_number: string } | undefined;

  let seq = 1;
  if (row) {
    const parts = row.invoice_number.split('-');
    seq = parseInt(parts[2]) + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function generatePdf(
  res: Response,
  invoice: { invoiceNumber: string; invoiceDate: string; periodStart: string; periodEnd: string },
  config: Record<string, string>,
  items: LineItem[],
  totalHours: number,
  totalAmount: number,
  hourlyRate: number,
) {
  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // Dark navy header bar
  doc.rect(0, 0, doc.page.width, 80).fill('#1e293b');
  doc.fontSize(28).font('Helvetica-Bold').fillColor('#ffffff')
    .text('INVOICE', 50, 28);
  doc.moveDown(2);

  // Contractor Information
  const y1 = 100;
  doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold')
    .text('Contractor Information', 50, y1);
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#333');
  if (config.contractor_name) doc.text(config.contractor_name);
  if (config.contractor_address) doc.text(config.contractor_address);
  if (config.contractor_city_state_zip) doc.text(config.contractor_city_state_zip);
  if (config.contractor_phone) doc.text(`Phone: ${config.contractor_phone}`);
  if (config.contractor_email) doc.text(`Email: ${config.contractor_email}`);
  if (config.contractor_ubi) doc.text(`UBI: ${config.contractor_ubi}`);
  if (config.contractor_tax_id_last4) doc.text(`Tax ID (last 4): ${config.contractor_tax_id_last4}`);
  doc.moveDown(1);

  // Invoice Details + Bill To side by side
  const detailsY = doc.y;
  doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold')
    .text('Invoice Details', 50, detailsY);
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#333');
  doc.text(`Invoice Number: ${invoice.invoiceNumber}`);
  doc.text(`Invoice Date: ${invoice.invoiceDate}`);
  doc.text(`Billing Period: ${invoice.periodStart} to ${invoice.periodEnd}`);

  const billToY = detailsY;
  doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold')
    .text('Bill To', 350, billToY);
  doc.fontSize(10).font('Helvetica').fillColor('#333');
  if (config.client_name) doc.text(config.client_name, 350);
  if (config.client_company) doc.text(config.client_company, 350);
  if (config.client_address) doc.text(config.client_address, 350);
  if (config.client_city_state_zip) doc.text(config.client_city_state_zip, 350);
  doc.moveDown(1);

  // Rate section
  const rateY = Math.max(doc.y, detailsY + 80);
  doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold')
    .text('Rate', 50, rateY);
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#333');
  doc.text(`Agreed Hourly Rate: $${hourlyRate.toFixed(2)}`);
  doc.moveDown(1);

  // Services Performed table
  doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold')
    .text('Services Performed', 50);
  doc.moveDown(0.5);

  // Table columns
  const colDate = 50;
  const colLoc = 130;
  const colDesc = 195;
  const colHrs = 390;
  const colRate = 440;
  const colAmt = 500;

  // Helper to draw table header row
  function drawTableHeader() {
    doc.rect(colDate, doc.y, 512, 18).fill('#e2e8f0');
    const hy = doc.y + 4;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text('Date', colDate + 4, hy, { width: 76 });
    doc.text('Location', colLoc + 4, hy, { width: 60 });
    doc.text('Description', colDesc + 4, hy, { width: 190 });
    doc.text('Hours', colHrs + 4, hy, { width: 44 });
    doc.text('Rate', colRate + 4, hy, { width: 50 });
    doc.text('Amount', colAmt + 4, hy, { width: 55 });
    doc.y = hy + 18;
  }

  drawTableHeader();

  // Table rows — pre-measure to prevent page splits
  const pageBottom = 720;
  doc.font('Helvetica').fontSize(8).fillColor('#333');
  for (const item of items) {
    // Pre-measure the row height based on description
    const descHeight = doc.heightOfString(item.description, { width: 190 });
    const rowHeight = Math.max(descHeight, 12) + 2;

    // If this row won't fit, break page and reprint header
    if (doc.y + rowHeight > pageBottom) {
      doc.addPage();
      drawTableHeader();
      doc.font('Helvetica').fontSize(8).fillColor('#333');
    }

    const rowY = doc.y + 2;
    doc.text(item.date, colDate + 4, rowY, { width: 76 });
    doc.text(item.location, colLoc + 4, rowY, { width: 60 });
    doc.text(item.description, colDesc + 4, rowY, { width: 190 });
    doc.text(item.hours.toFixed(2), colHrs + 4, rowY, { width: 44 });
    doc.text(`$${item.rate.toFixed(2)}`, colRate + 4, rowY, { width: 50 });
    doc.text(`$${item.amount.toFixed(2)}`, colAmt + 4, rowY, { width: 55 });

    doc.y = rowY + Math.max(descHeight, 12);

    // Light border
    doc.moveTo(colDate, doc.y).lineTo(colDate + 512, doc.y).strokeColor('#e2e8f0').stroke();
  }

  // Totals row
  doc.moveDown(0.3);
  doc.rect(colDate, doc.y, 512, 20).fill('#1e293b');
  const totY = doc.y + 5;
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
  doc.text('TOTAL', colDesc + 4, totY, { width: 190 });
  doc.text(totalHours.toFixed(2), colHrs + 4, totY, { width: 44 });
  doc.text('', colRate + 4, totY, { width: 50 });
  doc.text(`$${totalAmount.toFixed(2)}`, colAmt + 4, totY, { width: 55 });

  doc.end();
}

// GET /api/invoices — list all invoices
router.get('/', (_req, res) => {
  try {
    const invoices = db.prepare(
      'SELECT * FROM invoices ORDER BY created_at DESC'
    ).all() as InvoiceRow[];
    res.json(invoices);
  } catch (err) {
    console.error('Failed to list invoices:', err);
    res.status(500).json({ error: 'Could not list invoices' });
  }
});

// GET /api/invoices/periods — get available biweekly periods
router.get('/periods', (_req, res) => {
  res.json(getBiweeklyPeriods(6));
});

// GET /api/invoices/config — get invoice config
router.get('/config', (_req, res) => {
  try {
    res.json(getConfig());
  } catch (err) {
    console.error('Failed to get invoice config:', err);
    res.status(500).json({ error: 'Could not get config' });
  }
});

// PUT /api/invoices/config — update invoice config
router.put('/config', (req, res) => {
  try {
    const updates = req.body as Record<string, string>;
    const stmt = db.prepare('UPDATE invoice_config SET value = ? WHERE key = ?');
    for (const [key, value] of Object.entries(updates)) {
      stmt.run(value, key);
    }
    res.json(getConfig());
  } catch (err) {
    console.error('Failed to update invoice config:', err);
    res.status(500).json({ error: 'Could not update config' });
  }
});

// GET /api/invoices/preview — preview line items for a period
router.get('/preview', (req, res) => {
  try {
    const { periodStart, periodEnd } = req.query as { periodStart: string; periodEnd: string };
    if (!periodStart || !periodEnd) {
      res.status(400).json({ error: 'periodStart and periodEnd are required' });
      return;
    }

    const config = getConfig();
    const hourlyRate = parseFloat(config.hourly_rate) || 0;
    const items = getLineItems(periodStart, periodEnd, hourlyRate);
    const totalHours = items.reduce((sum, i) => sum + i.hours, 0);
    const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

    res.json({ items, totalHours, totalAmount, hourlyRate });
  } catch (err) {
    console.error('Failed to preview invoice:', err);
    res.status(500).json({ error: 'Could not preview invoice' });
  }
});

interface TaxPaymentRow {
  id: number;
  amount: number;
  payment_date: string;
  quarter: number;
  tax_year: number;
  payment_method: string;
  confirmation_number: string;
  notes: string;
  created_at: string;
}

interface Expected1099Row {
  id: number;
  tax_year: number;
  payer_name: string;
  payer_tin_last4: string;
  expected_amount: number;
  received: number;
  received_amount: number | null;
  notes: string;
  created_at: string;
}

function getTaxSummaryData(year: number) {
  const config = getConfig();
  const taxRate = parseFloat(config.tax_rate) || 30;

  const invoices = db.prepare(
    `SELECT total_hours, total_amount, paid_amount, period_start
     FROM invoices
     WHERE period_start >= ? AND period_start < ?`
  ).all(`${year}-01-01`, `${year + 1}-01-01`) as (Pick<InvoiceRow, 'total_hours' | 'total_amount' | 'paid_amount'> & { period_start: string })[];

  const taxPayments = db.prepare(
    `SELECT * FROM tax_payments WHERE tax_year = ? ORDER BY payment_date`
  ).all(year) as TaxPaymentRow[];

  const quarterLabels = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];
  const quarters = quarterLabels.map((label, i) => ({
    quarter: i + 1,
    label,
    hours: 0,
    earned: 0,
    paid: 0,
    unpaid: 0,
    estimatedTax: 0,
    taxPaid: 0,
  }));

  for (const inv of invoices) {
    const month = new Date(inv.period_start).getMonth();
    const qi = Math.floor(month / 3);
    const q = quarters[qi];
    q.hours += inv.total_hours;
    q.earned += inv.total_amount;
    q.paid += inv.paid_amount;
    q.unpaid += inv.total_amount - inv.paid_amount;
  }

  for (const tp of taxPayments) {
    const qi = tp.quarter - 1;
    quarters[qi].taxPaid += tp.amount;
  }

  const ytd = { hours: 0, earned: 0, paid: 0, unpaid: 0, estimatedTax: 0, taxPaid: 0 };
  for (const q of quarters) {
    q.hours = Math.round(q.hours * 100) / 100;
    q.earned = Math.round(q.earned * 100) / 100;
    q.paid = Math.round(q.paid * 100) / 100;
    q.unpaid = Math.round(q.unpaid * 100) / 100;
    q.estimatedTax = Math.round(q.earned * (taxRate / 100) * 100) / 100;
    q.taxPaid = Math.round(q.taxPaid * 100) / 100;
    ytd.hours += q.hours;
    ytd.earned += q.earned;
    ytd.paid += q.paid;
    ytd.unpaid += q.unpaid;
    ytd.taxPaid += q.taxPaid;
  }
  ytd.hours = Math.round(ytd.hours * 100) / 100;
  ytd.earned = Math.round(ytd.earned * 100) / 100;
  ytd.paid = Math.round(ytd.paid * 100) / 100;
  ytd.unpaid = Math.round(ytd.unpaid * 100) / 100;
  ytd.estimatedTax = Math.round(ytd.earned * (taxRate / 100) * 100) / 100;
  ytd.taxPaid = Math.round(ytd.taxPaid * 100) / 100;

  return { year, taxRate, quarters, ytd, taxPayments, config };
}

// GET /api/invoices/tax-summary — quarterly tax breakdown
router.get('/tax-summary', (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const { config: _config, ...summary } = getTaxSummaryData(year);
    res.json(summary);
  } catch (err) {
    console.error('Failed to get tax summary:', err);
    res.status(500).json({ error: 'Could not get tax summary' });
  }
});

// GET /api/invoices/tax-summary/pdf — Schedule C reference PDF
router.get('/tax-summary/pdf', (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const { config, taxRate, quarters, ytd, taxPayments } = getTaxSummaryData(year);

    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Tax-Summary-${year}.pdf"`);
    doc.pipe(res);

    // Header bar
    doc.rect(0, 0, doc.page.width, 80).fill('#1e293b');
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#ffffff')
      .text(`Annual Tax Summary — ${year}`, 50, 20);
    doc.fontSize(12).font('Helvetica').fillColor('#94a3b8')
      .text('Schedule C Reference', 50, 48);
    doc.moveDown(2);

    // Taxpayer info
    const y1 = 100;
    doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold')
      .text('Taxpayer Information', 50, y1);
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#333');
    if (config.contractor_name) doc.text(config.contractor_name);
    if (config.contractor_address) doc.text(config.contractor_address);
    if (config.contractor_city_state_zip) doc.text(config.contractor_city_state_zip);
    if (config.contractor_tax_id_last4) doc.text(`TIN (last 4): ***-**-${config.contractor_tax_id_last4}`);
    doc.moveDown(1);

    // Revenue summary table
    doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold')
      .text('Revenue Summary');
    doc.moveDown(0.5);

    const colQ = 50;
    const colInv = 180;
    const colPd = 300;
    const colUnp = 420;

    doc.rect(colQ, doc.y, 462, 18).fill('#e2e8f0');
    const rhy = doc.y + 4;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text('Quarter', colQ + 4, rhy, { width: 126 });
    doc.text('Invoiced', colInv + 4, rhy, { width: 116 });
    doc.text('Paid', colPd + 4, rhy, { width: 116 });
    doc.text('Unpaid', colUnp + 4, rhy, { width: 88 });
    doc.y = rhy + 18;

    doc.font('Helvetica').fontSize(8).fillColor('#333');
    for (const q of quarters) {
      const ry = doc.y + 2;
      doc.text(q.label, colQ + 4, ry, { width: 126 });
      doc.text(`$${q.earned.toFixed(2)}`, colInv + 4, ry, { width: 116 });
      doc.text(`$${q.paid.toFixed(2)}`, colPd + 4, ry, { width: 116 });
      doc.text(`$${q.unpaid.toFixed(2)}`, colUnp + 4, ry, { width: 88 });
      doc.y = ry + 14;
    }
    // Totals
    doc.rect(colQ, doc.y, 462, 18).fill('#1e293b');
    const tty = doc.y + 4;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('TOTAL', colQ + 4, tty, { width: 126 });
    doc.text(`$${ytd.earned.toFixed(2)}`, colInv + 4, tty, { width: 116 });
    doc.text(`$${ytd.paid.toFixed(2)}`, colPd + 4, tty, { width: 116 });
    doc.text(`$${ytd.unpaid.toFixed(2)}`, colUnp + 4, tty, { width: 88 });
    doc.y = tty + 22;
    doc.moveDown(1);

    // Estimated tax payments table
    doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold')
      .text('Estimated Tax Payments (1040-ES)');
    doc.moveDown(0.5);

    if (taxPayments.length === 0) {
      doc.fontSize(9).font('Helvetica').fillColor('#666')
        .text('No estimated tax payments recorded for this year.');
    } else {
      const cpDate = 50;
      const cpQtr = 150;
      const cpAmt = 210;
      const cpMeth = 300;
      const cpConf = 400;

      doc.rect(cpDate, doc.y, 462, 18).fill('#e2e8f0');
      const phy = doc.y + 4;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text('Date', cpDate + 4, phy, { width: 96 });
      doc.text('Quarter', cpQtr + 4, phy, { width: 56 });
      doc.text('Amount', cpAmt + 4, phy, { width: 86 });
      doc.text('Method', cpMeth + 4, phy, { width: 96 });
      doc.text('Confirmation #', cpConf + 4, phy, { width: 108 });
      doc.y = phy + 18;

      doc.font('Helvetica').fontSize(8).fillColor('#333');
      for (const tp of taxPayments) {
        const ry = doc.y + 2;
        doc.text(tp.payment_date, cpDate + 4, ry, { width: 96 });
        doc.text(`Q${tp.quarter}`, cpQtr + 4, ry, { width: 56 });
        doc.text(`$${tp.amount.toFixed(2)}`, cpAmt + 4, ry, { width: 86 });
        doc.text(tp.payment_method || '—', cpMeth + 4, ry, { width: 96 });
        doc.text(tp.confirmation_number || '—', cpConf + 4, ry, { width: 108 });
        doc.y = ry + 14;
      }
      // Payment total
      doc.rect(cpDate, doc.y, 462, 18).fill('#1e293b');
      const ptty = doc.y + 4;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('TOTAL', cpDate + 4, ptty, { width: 156 });
      doc.text(`$${ytd.taxPaid.toFixed(2)}`, cpAmt + 4, ptty, { width: 86 });
      doc.y = ptty + 22;
    }
    doc.moveDown(1);

    // Schedule C line items
    doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold')
      .text('Schedule C Reference Lines');
    doc.moveDown(0.5);

    const netProfit = ytd.earned;
    doc.fontSize(10).font('Helvetica').fillColor('#333');
    doc.text(`Line 1 — Gross receipts: $${ytd.earned.toFixed(2)}`);
    doc.text(`Line 7 — Gross income: $${ytd.earned.toFixed(2)}`);
    doc.text('Line 28 — Total expenses: $0.00 (expenses not tracked in DayLog)');
    doc.text(`Line 31 — Net profit: $${netProfit.toFixed(2)}`);
    doc.moveDown(1);

    // SE tax estimate
    doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold')
      .text('Self-Employment Tax Estimate');
    doc.moveDown(0.5);

    const seTaxable = Math.round(netProfit * 0.9235 * 100) / 100;
    const seTax = Math.round(seTaxable * 0.153 * 100) / 100;
    const federalEstimate = Math.round(netProfit * ((taxRate - 15.3) / 100) * 100) / 100;
    const totalEstimated = Math.round((seTax + Math.max(0, federalEstimate)) * 100) / 100;
    const remaining = Math.round((totalEstimated - ytd.taxPaid) * 100) / 100;

    doc.fontSize(10).font('Helvetica').fillColor('#333');
    doc.text(`SE taxable income (92.35% of net): $${seTaxable.toFixed(2)}`);
    doc.text(`Self-employment tax (15.3%): $${seTax.toFixed(2)}`);
    doc.text(`Federal income tax estimate (${Math.max(0, taxRate - 15.3).toFixed(1)}%): $${Math.max(0, federalEstimate).toFixed(2)}`);
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold');
    doc.text(`Total estimated tax liability: $${totalEstimated.toFixed(2)}`);
    doc.text(`Total estimated payments made: $${ytd.taxPaid.toFixed(2)}`);
    doc.text(remaining > 0
      ? `Remaining to pay: $${remaining.toFixed(2)}`
      : `Overpaid by: $${Math.abs(remaining).toFixed(2)}`);
    doc.moveDown(2);

    // Footer
    doc.fontSize(8).font('Helvetica').fillColor('#999')
      .text('For reference only — consult a tax professional.', 50, undefined, { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('Failed to generate tax summary PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not generate tax summary PDF' });
    }
  }
});

// POST /api/invoices/tax-payments — create tax payment
router.post('/tax-payments', (req, res) => {
  try {
    const { amount, payment_date, quarter, tax_year, payment_method, confirmation_number, notes } = req.body;
    if (!amount || !payment_date || !quarter || !tax_year) {
      res.status(400).json({ error: 'amount, payment_date, quarter, and tax_year are required' });
      return;
    }
    const result = db.prepare(
      `INSERT INTO tax_payments (amount, payment_date, quarter, tax_year, payment_method, confirmation_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(amount, payment_date, quarter, tax_year, payment_method || '', confirmation_number || '', notes || '');
    const payment = db.prepare('SELECT * FROM tax_payments WHERE id = ?').get(result.lastInsertRowid) as TaxPaymentRow;
    res.json(payment);
  } catch (err) {
    console.error('Failed to create tax payment:', err);
    res.status(500).json({ error: 'Could not create tax payment' });
  }
});

// PUT /api/invoices/tax-payments/:id — update tax payment
router.put('/tax-payments/:id', (req, res) => {
  try {
    const { amount, payment_date, quarter, tax_year, payment_method, confirmation_number, notes } = req.body;
    const existing = db.prepare('SELECT * FROM tax_payments WHERE id = ?').get(req.params.id) as TaxPaymentRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Tax payment not found' });
      return;
    }
    db.prepare(
      `UPDATE tax_payments SET amount = ?, payment_date = ?, quarter = ?, tax_year = ?, payment_method = ?, confirmation_number = ?, notes = ?
       WHERE id = ?`
    ).run(
      amount ?? existing.amount,
      payment_date ?? existing.payment_date,
      quarter ?? existing.quarter,
      tax_year ?? existing.tax_year,
      payment_method ?? existing.payment_method,
      confirmation_number ?? existing.confirmation_number,
      notes ?? existing.notes,
      req.params.id,
    );
    const updated = db.prepare('SELECT * FROM tax_payments WHERE id = ?').get(req.params.id) as TaxPaymentRow;
    res.json(updated);
  } catch (err) {
    console.error('Failed to update tax payment:', err);
    res.status(500).json({ error: 'Could not update tax payment' });
  }
});

// DELETE /api/invoices/tax-payments/:id — delete tax payment
router.delete('/tax-payments/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM tax_payments WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Tax payment not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete tax payment:', err);
    res.status(500).json({ error: 'Could not delete tax payment' });
  }
});

// GET /api/invoices/1099s — list expected 1099s with reconciliation
router.get('/1099s', (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const expected = db.prepare(
      'SELECT * FROM expected_1099s WHERE tax_year = ? ORDER BY payer_name'
    ).all(year) as Expected1099Row[];

    // Get actual invoiced amounts grouped by client (single-client for now)
    const config = getConfig();
    const clientName = config.client_company || config.client_name || 'Unknown';
    const invoiceTotal = db.prepare(
      `SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices
       WHERE period_start >= ? AND period_start < ?`
    ).get(`${year}-01-01`, `${year + 1}-01-01`) as { total: number };

    const actualByPayer: Record<string, number> = {};
    actualByPayer[clientName] = Math.round(invoiceTotal.total * 100) / 100;

    let totalExpected = 0;
    let totalReceived = 0;
    const discrepancies: Array<{
      payer: string;
      expected: number;
      invoiced: number;
      received: number | null;
      status: 'matched' | 'discrepancy' | 'pending' | 'missing';
    }> = [];

    for (const e of expected) {
      totalExpected += e.expected_amount;
      if (e.received && e.received_amount != null) {
        totalReceived += e.received_amount;
      }
      const invoiced = actualByPayer[e.payer_name] ?? 0;
      let status: 'matched' | 'discrepancy' | 'pending' | 'missing';
      if (!e.received) {
        status = invoiced === 0 ? 'missing' : 'pending';
      } else if (e.received_amount != null && Math.abs(e.received_amount - invoiced) < 0.01) {
        status = 'matched';
      } else {
        status = 'discrepancy';
      }
      discrepancies.push({
        payer: e.payer_name,
        expected: e.expected_amount,
        invoiced,
        received: e.received ? e.received_amount : null,
        status,
      });
    }

    const totalInvoiced = Object.values(actualByPayer).reduce((s, v) => s + v, 0);

    res.json({
      expected,
      actualByPayer,
      totalExpected: Math.round(totalExpected * 100) / 100,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalReceived: Math.round(totalReceived * 100) / 100,
      discrepancies,
    });
  } catch (err) {
    console.error('Failed to get 1099 reconciliation:', err);
    res.status(500).json({ error: 'Could not get 1099 reconciliation' });
  }
});

// POST /api/invoices/1099s — create expected 1099
router.post('/1099s', (req, res) => {
  try {
    const { tax_year, payer_name, payer_tin_last4, expected_amount, notes } = req.body;
    if (!tax_year || !payer_name) {
      res.status(400).json({ error: 'tax_year and payer_name are required' });
      return;
    }
    const result = db.prepare(
      `INSERT INTO expected_1099s (tax_year, payer_name, payer_tin_last4, expected_amount, notes)
       VALUES (?, ?, ?, ?, ?)`
    ).run(tax_year, payer_name, payer_tin_last4 || '', expected_amount || 0, notes || '');
    const row = db.prepare('SELECT * FROM expected_1099s WHERE id = ?').get(result.lastInsertRowid) as Expected1099Row;
    res.json(row);
  } catch (err) {
    console.error('Failed to create expected 1099:', err);
    res.status(500).json({ error: 'Could not create expected 1099' });
  }
});

// PUT /api/invoices/1099s/:id — update expected 1099
router.put('/1099s/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM expected_1099s WHERE id = ?').get(req.params.id) as Expected1099Row | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Expected 1099 not found' });
      return;
    }
    const { payer_name, payer_tin_last4, expected_amount, received, received_amount, notes } = req.body;
    db.prepare(
      `UPDATE expected_1099s SET payer_name = ?, payer_tin_last4 = ?, expected_amount = ?, received = ?, received_amount = ?, notes = ?
       WHERE id = ?`
    ).run(
      payer_name ?? existing.payer_name,
      payer_tin_last4 ?? existing.payer_tin_last4,
      expected_amount ?? existing.expected_amount,
      received ?? existing.received,
      received_amount !== undefined ? received_amount : existing.received_amount,
      notes ?? existing.notes,
      req.params.id,
    );
    const updated = db.prepare('SELECT * FROM expected_1099s WHERE id = ?').get(req.params.id) as Expected1099Row;
    res.json(updated);
  } catch (err) {
    console.error('Failed to update expected 1099:', err);
    res.status(500).json({ error: 'Could not update expected 1099' });
  }
});

// DELETE /api/invoices/1099s/:id — delete expected 1099
router.delete('/1099s/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM expected_1099s WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Expected 1099 not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete expected 1099:', err);
    res.status(500).json({ error: 'Could not delete expected 1099' });
  }
});

// POST /api/invoices/generate — generate invoice PDF + save to DB
router.post('/generate', (req, res) => {
  try {
    const { periodStart, periodEnd } = req.body as { periodStart: string; periodEnd: string };
    if (!periodStart || !periodEnd) {
      res.status(400).json({ error: 'periodStart and periodEnd are required' });
      return;
    }

    const config = getConfig();
    const hourlyRate = parseFloat(config.hourly_rate) || 0;
    const items = getLineItems(periodStart, periodEnd, hourlyRate);
    const totalHours = Math.round(items.reduce((sum, i) => sum + i.hours, 0) * 100) / 100;
    const totalAmount = Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;

    const invoiceNumber = getNextInvoiceNumber();
    const invoiceDate = new Date().toISOString().split('T')[0];

    // Save to DB
    db.prepare(
      `INSERT INTO invoices (invoice_number, invoice_date, period_start, period_end, hourly_rate, total_hours, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(invoiceNumber, invoiceDate, periodStart, periodEnd, hourlyRate, totalHours, totalAmount);

    // Generate and stream PDF
    generatePdf(res, { invoiceNumber, invoiceDate, periodStart, periodEnd }, config, items, totalHours, totalAmount, hourlyRate);
  } catch (err) {
    console.error('Failed to generate invoice:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not generate invoice' });
    }
  }
});

// GET /api/invoices/:id/pdf — re-download a past invoice
router.get('/:id/pdf', (req, res) => {
  try {
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as InvoiceRow | undefined;
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }

    const config = getConfig();
    const items = getLineItems(invoice.period_start, invoice.period_end, invoice.hourly_rate);

    generatePdf(
      res,
      {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        periodStart: invoice.period_start,
        periodEnd: invoice.period_end,
      },
      config,
      items,
      invoice.total_hours,
      invoice.total_amount,
      invoice.hourly_rate,
    );
  } catch (err) {
    console.error('Failed to download invoice PDF:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not generate PDF' });
    }
  }
});

// PATCH /api/invoices/:id/paid — update payment amount
router.patch('/:id/paid', (req, res) => {
  try {
    const { paid_amount } = req.body as { paid_amount: number };
    const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as InvoiceRow | undefined;
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    const paidDate = paid_amount >= invoice.total_amount
      ? (invoice.paid_date ?? new Date().toISOString().split('T')[0])
      : null;
    db.prepare('UPDATE invoices SET paid_amount = ?, paid_date = ? WHERE id = ?').run(paid_amount, paidDate, req.params.id);
    const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id) as InvoiceRow;
    res.json(updated);
  } catch (err) {
    console.error('Failed to update invoice payment status:', err);
    res.status(500).json({ error: 'Could not update payment status' });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete invoice:', err);
    res.status(500).json({ error: 'Could not delete invoice' });
  }
});

export { router as invoicesRouter };

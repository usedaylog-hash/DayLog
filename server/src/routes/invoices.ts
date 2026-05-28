import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { db } from '../db/connection.js';

const router = Router();

// Biweekly anchor: Monday 2026-01-05
const ANCHOR = new Date('2026-01-05T00:00:00');
const PERIOD_MS = 14 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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
}

interface SessionRow {
  id: number;
  clock_in: string;
  clock_out: string;
}

interface LineItem {
  date: string;
  location: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
}

function getBiweeklyPeriods(count: number): Array<{ start: string; end: string; label: string }> {
  const now = Date.now();
  const elapsed = now - ANCHOR.getTime();
  const currentIndex = Math.floor(elapsed / PERIOD_MS);

  const periods: Array<{ start: string; end: string; label: string }> = [];
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  for (let i = 0; i < count; i++) {
    const idx = currentIndex - i;
    const start = new Date(ANCHOR.getTime() + idx * PERIOD_MS); // Monday
    const end = new Date(start.getTime() + 11 * DAY_MS); // Friday of second week (day 11 = +11 days from Monday)
    periods.push({
      start: fmt(start),
      end: fmt(end),
      label: `${fmt(start)} to ${fmt(end)}`,
    });
  }
  return periods;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
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
    const ms = new Date(session.clock_out).getTime() - new Date(session.clock_in).getTime();
    const sessionHours = Math.round((ms / 3_600_000) * 100) / 100;
    const dateStr = session.clock_in.split('T')[0];
    const timeRange = `${formatTime(session.clock_in)} – ${formatTime(session.clock_out)}`;

    // Extract work items from summary
    const workItems: string[] = [];
    if (session.summary) {
      for (const line of session.summary.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('Session:')) continue;
        if (/^\d+ commits?$/.test(trimmed)) continue;
        // Strip git hash prefix if present
        const commitMatch = trimmed.match(/^[a-f0-9]{7}\s+(.+)/);
        workItems.push(commitMatch ? commitMatch[1] : trimmed);
      }
    }

    const description = workItems.length > 0
      ? `${timeRange}\n${workItems.join('\n')}`
      : `${timeRange}: Development work`;

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
  res: any,
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

  // Table header
  doc.rect(colDate, doc.y, 512, 18).fill('#e2e8f0');
  const headerY = doc.y + 4;
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e293b');
  doc.text('Date', colDate + 4, headerY, { width: 76 });
  doc.text('Location', colLoc + 4, headerY, { width: 60 });
  doc.text('Description', colDesc + 4, headerY, { width: 190 });
  doc.text('Hours', colHrs + 4, headerY, { width: 44 });
  doc.text('Rate', colRate + 4, headerY, { width: 50 });
  doc.text('Amount', colAmt + 4, headerY, { width: 55 });
  doc.y = headerY + 18;

  // Table rows
  doc.font('Helvetica').fontSize(8).fillColor('#333');
  for (const item of items) {
    if (doc.y > 700) doc.addPage();

    const rowY = doc.y + 2;
    doc.text(item.date, colDate + 4, rowY, { width: 76 });
    doc.text(item.location, colLoc + 4, rowY, { width: 60 });
    doc.text(item.description, colDesc + 4, rowY, { width: 190 });
    doc.text(item.hours.toFixed(2), colHrs + 4, rowY, { width: 44 });
    doc.text(`$${item.rate.toFixed(2)}`, colRate + 4, rowY, { width: 50 });
    doc.text(`$${item.amount.toFixed(2)}`, colAmt + 4, rowY, { width: 55 });

    // Measure how much vertical space the description used
    const descHeight = doc.heightOfString(item.description, { width: 190 });
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

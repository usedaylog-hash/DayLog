export interface Commit {
  id: number;
  session_id: number;
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  comment: string | null;
}

export interface Session {
  id: number;
  clock_in: string;
  clock_out: string | null;
  summary: string | null;
  handoff: string | null;
  created_at: string;
  notes?: Note[];
  commits?: Commit[];
}

export interface Note {
  id: number;
  session_id: number;
  content: string;
  timestamp: string;
  created_at: string;
}

export interface TestRun {
  timestamp: string;
  environment: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
  failedTests: string[];
  filename: string;
}

export interface Attachment {
  type: 'screenshot' | 'video';
  path: string;
  available: boolean;
}

export interface FailedTestDetail {
  name: string;
  error: string;
  attachments: Attachment[];
}

export interface TestRunDetail extends TestRun {
  failedTestDetails: FailedTestDetail[];
  skippedTests: string[];
}

export interface BugReport {
  filename: string;
  title: string;
  date: string;
  severity: string;
  summary: string;
  featureArea: string;
  environment: string;
  reporter: string;
}

export interface PortfolioSession {
  id: number;
  date: string;
  duration: string;
  commitCount: number;
  noteCount: number;
  summary: string | null;
  activity: string;
}

export interface PortfolioStats {
  totalHours: string;
  sessionCount: number;
  commitCount: number;
  bugsFound: number;
  testRuns: number;
  passRate: number;
}

export interface PortfolioData {
  stats: PortfolioStats;
  sessions: PortfolioSession[];
  bugs: BugReport[];
}

export interface Invoice {
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

export interface QuarterData {
  quarter: number;
  label: string;
  hours: number;
  earned: number;
  paid: number;
  unpaid: number;
  estimatedTax: number;
}

export interface TaxSummary {
  year: number;
  taxRate: number;
  quarters: QuarterData[];
  ytd: Omit<QuarterData, 'quarter' | 'label'>;
}

export interface InvoiceLineItem {
  date: string;
  location: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
}

export interface InvoicePreview {
  items: InvoiceLineItem[];
  totalHours: number;
  totalAmount: number;
  hourlyRate: number;
}

export interface BiweeklyPeriod {
  start: string;
  end: string;
  label: string;
}

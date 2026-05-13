export interface Session {
  id: number;
  clock_in: string;
  clock_out: string | null;
  summary: string | null;
  created_at: string;
  notes?: Note[];
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

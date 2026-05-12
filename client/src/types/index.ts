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

export interface FailedTest {
  title: string;
  projectName: string;
  errorMessage?: string;
}

export interface TestRun {
  timestamp: string;
  environment: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  duration: number;
  reportPath: string;
  failedTests: FailedTest[];
}

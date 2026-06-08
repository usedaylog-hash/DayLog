export interface Session {
  id: number;
  clock_in: string;
  clock_out: string | null;
  summary: string | null;
  handoff: string | null;
  created_at: string;
}

export interface Note {
  id: number;
  session_id: number;
  content: string;
  timestamp: string;
  created_at: string;
}

export interface Commit {
  id: number;
  session_id: number;
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  comment: string | null;
  created_at: string;
}

export interface SessionBreak {
  id: number;
  session_id: number;
  pause_time: string;
  resume_time: string | null;
  reason: string;
  created_at: string;
}

export interface SessionWithNotes extends Session {
  notes: Note[];
  commits: Commit[];
  breaks: SessionBreak[];
}

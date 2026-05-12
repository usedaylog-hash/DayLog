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

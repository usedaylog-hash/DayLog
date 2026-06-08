export interface NoteInput {
  content: string;
  timestamp: string;
}

export interface CommitInput {
  hash: string;
  message: string;
  comment: string | null;
}

export interface BreakInput {
  pause_time: string;
  resume_time: string | null;
  reason: string;
}

export function generateSummary(clockIn: string, clockOut: string, notes: NoteInput[], commits: CommitInput[] = [], breaks: BreakInput[] = []): string {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  let ms = end.getTime() - start.getTime();
  for (const b of breaks) {
    const bStart = new Date(b.pause_time).getTime();
    const bEnd = b.resume_time ? new Date(b.resume_time).getTime() : end.getTime();
    ms -= (bEnd - bStart);
  }
  if (ms < 0) ms = 0;
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);

  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const lines = [
    `Session: ${duration}`,
  ];

  if (commits.length > 0) {
    lines.push(`${commits.length} commit${commits.length !== 1 ? 's' : ''}`);
  }
  if (notes.length > 0) {
    lines.push(`${notes.length} note${notes.length !== 1 ? 's' : ''}`);
  }
  lines.push('');

  for (const commit of commits) {
    const short = commit.hash.slice(0, 7);
    const line = `${short} ${commit.message}`;
    lines.push(commit.comment ? `${line} — ${commit.comment}` : line);
  }

  for (const note of notes) {
    const time = new Date(note.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    lines.push(`[${time}] ${note.content}`);
  }

  return lines.join('\n');
}

export function generateHandoff(clockIn: string, clockOut: string, commits: CommitInput[], note?: string, breaks: BreakInput[] = []): string {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  let ms = end.getTime() - start.getTime();
  for (const b of breaks) {
    const bStart = new Date(b.pause_time).getTime();
    const bEnd = b.resume_time ? new Date(b.resume_time).getTime() : end.getTime();
    ms -= (bEnd - bStart);
  }
  if (ms < 0) ms = 0;
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const dateStr = end.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const lines: string[] = [
    '# Last Session Handoff',
    '',
    `**Date:** ${dateStr}`,
    `**Duration:** ${duration}`,
  ];

  if (commits.length > 0) {
    lines.push('', '## Commits');
    for (const commit of commits) {
      const short = commit.hash.slice(0, 7);
      lines.push(`- \`${short}\` ${commit.message}`);
      if (commit.comment) {
        lines.push(`  - _${commit.comment}_`);
      }
    }
  }

  if (breaks.length > 0) {
    lines.push('', '## Breaks');
    for (const b of breaks) {
      const pTime = new Date(b.pause_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const rTime = b.resume_time
        ? new Date(b.resume_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'ongoing';
      lines.push(`- ${pTime} – ${rTime}: ${b.reason || 'No reason given'}`);
    }
  }

  if (note?.trim()) {
    lines.push('', '## What\'s Still Open', note.trim());
  }

  return lines.join('\n') + '\n';
}

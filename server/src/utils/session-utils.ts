export interface NoteInput {
  content: string;
  timestamp: string;
}

export interface CommitInput {
  hash: string;
  message: string;
  comment: string | null;
}

export function generateSummary(clockIn: string, clockOut: string, notes: NoteInput[], commits: CommitInput[] = []): string {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const ms = end.getTime() - start.getTime();
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

export function generateHandoff(clockIn: string, clockOut: string, commits: CommitInput[], note?: string): string {
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const ms = end.getTime() - start.getTime();
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

  if (note?.trim()) {
    lines.push('', '## What\'s Still Open', note.trim());
  }

  return lines.join('\n') + '\n';
}

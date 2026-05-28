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

export function formatDuration(clockIn: string, clockOut: string): string {
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatDurationMs(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function extractActivity(summary: string | null): string {
  if (!summary) return '';
  return summary.split('\n').filter((l) => l.trim() && !l.startsWith('Session:'))[0] || '';
}

export function parseBugContent(content: string, filename: string): BugReport | null {
  try {
    // Extract title from first heading
    const titleMatch = content.match(/^#+ (?:Bug Report:\s*)?(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : filename;

    // Extract date
    const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/);
    const date = dateMatch ? dateMatch[1].trim() : '';

    // Extract severity — default to Info for findings without explicit severity
    const severityMatch = content.match(/\*\*Severity:\*\*\s*(.+)/i);
    const severity = severityMatch ? severityMatch[1].trim() : 'Info';

    // Extract summary from Summary section
    const summaryMatch = content.match(/###?\s*Summary\s*\n\n(.+?)(?:\n\n|$)/s);
    const summary = summaryMatch ? summaryMatch[1].trim().split('\n')[0] : '';

    // Extract environment
    const envMatch = content.match(/\*\*Environment:\*\*\s*(.+)/);
    const environment = envMatch ? envMatch[1].trim() : '';

    // Extract reporter
    const reporterMatch = content.match(/\*\*Reporter:\*\*\s*(.+)/);
    const reporter = reporterMatch ? reporterMatch[1].trim() : 'Luke';

    // Derive feature area from filename
    const slugMatch = filename.match(/^(?:BUG|FINDING)-\d{4}-\d{2}-\d{2}-(.+)\.md$/);
    let featureArea = 'General';
    if (slugMatch) {
      const slug = slugMatch[1];
      const areaMap: [RegExp, string][] = [
        [/^edit-fuel/, 'Fuel Records'],
        [/^fuel/, 'Fuel Records'],
        [/^ai-usage/, 'AI Usage Analytics'],
        [/^ai-analysis/, 'AI Analysis'],
        [/^admin/, 'Admin Panel'],
        [/^non-admin/, 'Admin Panel'],
        [/^double-api/, 'Analytics'],
        [/^singular-mileage/, 'Mileage'],
        [/^parts/, 'Parts'],
        [/^settings/, 'Settings'],
        [/^ownership/, 'Ownership'],
        [/^carbuddy/, 'CarBuddy AI'],
      ];
      for (const [pattern, area] of areaMap) {
        if (pattern.test(slug)) {
          featureArea = area;
          break;
        }
      }
      if (featureArea === 'General') {
        featureArea = slug.split('-')[0].charAt(0).toUpperCase() + slug.split('-')[0].slice(1);
      }
    }

    return { filename, title, date, severity, summary, featureArea, environment, reporter };
  } catch {
    return null;
  }
}

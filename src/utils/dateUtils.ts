export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
};

/**
 * Standardizes any date string into uniform DD-MMM-YYYY format (e.g. "08-Sep-2026").
 * Handles:
 *  - "8-Sep-2026" -> "08-Sep-2026"
 *  - "09-Sep-2026" -> "09-Sep-2026"
 *  - "8-Sep-26" -> "08-Sep-2026"
 *  - "2026-09-08" -> "08-Sep-2026"
 *  - "2026/09/08" -> "08-Sep-2026"
 */
export function standardizeDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();

  // Pattern: D-MMM-YYYY or DD-MMM-YYYY or DD-MMM-YY (e.g. 8-Sep-2026, 09-Sep-2026, 8-Sep-26)
  const dMmmYRegex = /^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})$/;
  const match1 = trimmed.match(dMmmYRegex);
  if (match1) {
    const day = match1[1].padStart(2, '0');
    const monthKey = match1[2].toLowerCase();
    const monthIdx = MONTH_MAP[monthKey];
    let year = match1[3];
    if (year.length === 2) {
      year = `20${year}`;
    }
    if (monthIdx !== undefined) {
      return `${day}-${MONTH_NAMES[monthIdx]}-${year}`;
    }
  }

  // Pattern: YYYY-MM-DD or YYYY/MM/DD
  const yyyyMmDdRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
  const match2 = trimmed.match(yyyyMmDdRegex);
  if (match2) {
    const year = match2[1];
    const monthIdx = parseInt(match2[2], 10) - 1;
    const day = match2[3].padStart(2, '0');
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day}-${MONTH_NAMES[monthIdx]}-${year}`;
    }
  }

  // Pattern: DD-MM-YYYY or DD/MM/YYYY
  const ddMmYyyyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/;
  const match3 = trimmed.match(ddMmYyyyRegex);
  if (match3) {
    const day = match3[1].padStart(2, '0');
    const monthIdx = parseInt(match3[2], 10) - 1;
    let year = match3[3];
    if (year.length === 2) year = `20${year}`;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day}-${MONTH_NAMES[monthIdx]}-${year}`;
    }
  }

  // Fallback: standard Javascript Date parsing
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[parsed.getMonth()];
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return trimmed;
}

/**
 * Parses date string into Unix millisecond timestamp for correct chronological sorting
 */
export function parseDateToTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const std = standardizeDate(dateStr);
  const match = std.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthIdx = MONTH_MAP[match[2].toLowerCase()];
    const year = parseInt(match[3], 10);
    if (monthIdx !== undefined) {
      return new Date(year, monthIdx, day).getTime();
    }
  }
  const fallback = new Date(dateStr).getTime();
  return isNaN(fallback) ? 0 : fallback;
}

/**
 * Returns today's date formatted as standard DD-MMM-YYYY
 */
export function getTodayStandardDate(d = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export const getTodayDateString = getTodayStandardDate;

/**
 * Checks if a given date string corresponds to today's date (comparing year, month, day).
 */
export function isTodayDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const std = standardizeDate(dateStr);
  const todayStd = getTodayStandardDate();
  if (std === todayStd) return true;

  const ts = parseDateToTimestamp(dateStr);
  if (ts > 0) {
    const d = new Date(ts);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }
  return false;
}

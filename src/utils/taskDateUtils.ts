import { standardizeDate } from './dateUtils';

export const CONFIGURED_TIMEZONE = 'Asia/Kolkata';

export interface DateOptionInfo {
  offset: number;
  relativeLabel: string;
  dateKey: string; // YYYY-MM-DD
  formattedDate: string; // e.g. 24-Sep-2026
}

/**
 * Get current year, month, day in the configured timezone (Asia/Kolkata)
 */
export function getZonedDateParts(
  date = new Date(),
  timeZone = CONFIGURED_TIMEZONE
): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.format(date); // "YYYY-MM-DD"
  const [year, month, day] = parts.split('-').map(Number);
  return { year, month: month - 1, day };
}

/**
 * Returns ISO date key YYYY-MM-DD in the configured timezone with day offset
 */
export function getIsoDateKeyInTimezone(
  offsetDays = 0,
  timeZone = CONFIGURED_TIMEZONE
): string {
  const { year, month, day } = getZonedDateParts(new Date(), timeZone);
  const target = new Date(Date.UTC(year, month, day + offsetDays));
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(target.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert YYYY-MM-DD or any recognized date string to DD-MMM-YYYY
 */
export function formatCalendarDate(dateStr: string): string {
  if (!dateStr) return '';
  return standardizeDate(dateStr) || dateStr;
}

/**
 * Returns the 3 upcoming date options (Today, Tomorrow, Day After Tomorrow)
 */
export function getUpcomingDateOptions(
  timeZone = CONFIGURED_TIMEZONE
): DateOptionInfo[] {
  return [
    {
      offset: 0,
      relativeLabel: 'Today',
      dateKey: getIsoDateKeyInTimezone(0, timeZone),
      formattedDate: formatCalendarDate(getIsoDateKeyInTimezone(0, timeZone)),
    },
    {
      offset: 1,
      relativeLabel: 'Tomorrow',
      dateKey: getIsoDateKeyInTimezone(1, timeZone),
      formattedDate: formatCalendarDate(getIsoDateKeyInTimezone(1, timeZone)),
    },
    {
      offset: 2,
      relativeLabel: 'Day After Tomorrow',
      dateKey: getIsoDateKeyInTimezone(2, timeZone),
      formattedDate: formatCalendarDate(getIsoDateKeyInTimezone(2, timeZone)),
    },
  ];
}

/**
 * Checks if two date keys refer to the same calendar day.
 * Handles both "2026-09-24" and "24-Sep-2026" formats interchangeably.
 */
export function areDatesEqual(dateA: string, dateB: string): boolean {
  if (!dateA || !dateB) return false;
  if (dateA.trim() === dateB.trim()) return true;

  const stdA = standardizeDate(dateA);
  const stdB = standardizeDate(dateB);
  if (stdA && stdB && stdA.toLowerCase() === stdB.toLowerCase()) {
    return true;
  }

  return dateA.trim().toLowerCase() === dateB.trim().toLowerCase();
}

/**
 * Converts date string (like "24-Sep-2026") into YYYY-MM-DD for date input elements
 */
export function toInputDateValue(dateStr: string): string {
  if (!dateStr) return '';
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return dateStr.trim();
  }
  const std = standardizeDate(dateStr);
  const match = std.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})$/);
  if (match) {
    const day = match[1];
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const mIdx = monthNames.indexOf(match[2].toLowerCase());
    if (mIdx !== -1) {
      const mStr = String(mIdx + 1).padStart(2, '0');
      return `${match[3]}-${mStr}-${day}`;
    }
  }
  return dateStr;
}

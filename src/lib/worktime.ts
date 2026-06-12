/** Working-time math: 8-hour workdays, weekends excluded. */

export const WORKDAY_HOURS = 8;

/**
 * Working hours elapsed between two instants. Each weekday contributes
 * at most WORKDAY_HOURS; Saturdays and Sundays contribute nothing.
 */
export function workingHoursBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (!(end > start)) return 0;

  let total = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    const dayStart = new Date(cursor);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);

    const weekday = dayStart.getDay();
    if (weekday !== 0 && weekday !== 6) {
      const sliceStart = cursor > dayStart ? cursor : dayStart;
      const sliceEnd = end < nextDay ? end : nextDay;
      const hours = (sliceEnd.getTime() - sliceStart.getTime()) / 3_600_000;
      total += Math.min(hours, WORKDAY_HOURS);
    }
    cursor.setTime(nextDay.getTime());
  }
  return total;
}

/** "5.2h" under one workday, otherwise "2.4d" (1d = 8 working hours). */
export function formatWorkingHours(hours: number): string {
  if (hours < WORKDAY_HOURS) return `${hours.toFixed(1)}h`;
  return `${(hours / WORKDAY_HOURS).toFixed(1)}d`;
}

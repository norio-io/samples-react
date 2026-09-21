/** 営業時間。開始時刻は含み、終了時刻は含まない。 */
export const OPENING_HOUR = 9
export const CLOSING_HOUR = 21

/** 予約の開始時刻として選べる時刻。 */
export const SELECTABLE_START_HOURS: readonly number[] = Array.from(
  { length: CLOSING_HOUR - OPENING_HOUR },
  (_, index) => OPENING_HOUR + index,
)

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function isValidStartHour(startHour: number): boolean {
  return Number.isInteger(startHour) && startHour >= OPENING_HOUR && startHour < CLOSING_HOUR
}

/** 終了時刻が営業時間を超えないこと。 */
export function fitsInBusinessHours(startHour: number, hours: number): boolean {
  return isValidStartHour(startHour) && Number.isInteger(hours) && hours >= 1 && startHour + hours <= CLOSING_HOUR
}

/** 指定の開始時刻から取り得る最大の利用時間数。 */
export function maxHoursFrom(startHour: number): number {
  return Math.max(0, CLOSING_HOUR - startHour)
}

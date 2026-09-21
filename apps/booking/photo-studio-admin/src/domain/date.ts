/** YYYY-MM-DD をタイムゾーンに依存せず扱うための補助。内部表現は UTC とする。 */

export function parseDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined || Number.isNaN(year)) {
    throw new Error(`日付の形式が不正です: ${date}`)
  }
  return new Date(Date.UTC(year, month - 1, day))
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  const base = parseDate(date)
  base.setUTCDate(base.getUTCDate() + days)
  return formatDate(base)
}

/** 日付の差（days）。a - b を返す。 */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86_400_000)
}

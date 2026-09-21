import { afterEach, describe, expect, it, vi } from 'vitest'
import { addDays, diffDays, formatDate, getToday, parseDate } from './date'

afterEach(() => {
  vi.useRealTimers()
})

describe('日付の演算', () => {
  it('日数を加減する', () => {
    expect(addDays('2026-09-21', 1)).toBe('2026-09-22')
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('日数の差を返す', () => {
    expect(diffDays('2026-09-22', '2026-09-21')).toBe(1)
    expect(diffDays('2026-09-21', '2026-09-22')).toBe(-1)
  })

  it('不正な形式は例外とする', () => {
    expect(() => parseDate('2026/09/21')).toThrowError()
  })
})

describe('getToday', () => {
  it('地域時刻での暦上の日付を返す', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // JST（UTC+9）では 2026-09-22 08:30 にあたる。
    vi.setSystemTime(new Date('2026-09-21T23:30:00Z'))

    expect(getToday()).toBe('2026-09-22')
    // UTC 基準では前日となるため、「今日」の判定には用いない。
    expect(formatDate(new Date())).toBe('2026-09-21')
  })

  it('日付をまたがない時刻では UTC 基準と一致する', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-21T03:00:00Z'))
    expect(getToday()).toBe('2026-09-21')
  })
})

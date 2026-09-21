import { describe, expect, it } from 'vitest'
import {
  CLOSING_HOUR,
  fitsInBusinessHours,
  formatHour,
  isValidStartHour,
  maxHoursFrom,
  OPENING_HOUR,
  SELECTABLE_START_HOURS,
} from './businessHours'

describe('営業時間', () => {
  it('9:00 から 21:00 とする', () => {
    expect(OPENING_HOUR).toBe(9)
    expect(CLOSING_HOUR).toBe(21)
  })

  it('選択できる開始時刻は営業開始から終了の1時間前まで', () => {
    expect(SELECTABLE_START_HOURS[0]).toBe(9)
    expect(SELECTABLE_START_HOURS[SELECTABLE_START_HOURS.length - 1]).toBe(20)
    expect(SELECTABLE_START_HOURS).toHaveLength(12)
  })

  it('開始時刻の境界を判定する', () => {
    expect(isValidStartHour(8)).toBe(false)
    expect(isValidStartHour(9)).toBe(true)
    expect(isValidStartHour(20)).toBe(true)
    expect(isValidStartHour(21)).toBe(false)
    expect(isValidStartHour(9.5)).toBe(false)
  })

  it('終了時刻が営業時間を超えないことを判定する', () => {
    expect(fitsInBusinessHours(9, 1)).toBe(true)
    expect(fitsInBusinessHours(9, 12)).toBe(true)
    expect(fitsInBusinessHours(9, 13)).toBe(false)
    expect(fitsInBusinessHours(20, 1)).toBe(true)
    expect(fitsInBusinessHours(20, 2)).toBe(false)
    expect(fitsInBusinessHours(9, 0)).toBe(false)
  })

  it('開始時刻から取り得る最大の利用時間数を返す', () => {
    expect(maxHoursFrom(9)).toBe(12)
    expect(maxHoursFrom(20)).toBe(1)
  })

  it('時刻を2桁で表記する', () => {
    expect(formatHour(9)).toBe('09:00')
    expect(formatHour(21)).toBe('21:00')
  })
})

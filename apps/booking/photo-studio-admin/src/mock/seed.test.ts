import { describe, expect, it } from 'vitest'
import { diffDays } from '../domain/date'
import { RESERVATION_STATUSES } from '../domain/types'
import { createSeedReservations, SEED_ANCHOR_DATE, SEED_RESERVATION_COUNT, STUDIOS } from './seed'

describe('初期データ', () => {
  it('生成が決定的であり、何度生成しても同一の内容となる', () => {
    expect(createSeedReservations()).toEqual(createSeedReservations())
  })

  it('規定の件数を生成する', () => {
    expect(createSeedReservations()).toHaveLength(SEED_RESERVATION_COUNT)
  })

  it('id が一意である', () => {
    const ids = createSeedReservations().map((reservation) => reservation.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('基準日の前後1か月程度に分布する', () => {
    for (const reservation of createSeedReservations()) {
      const offset = diffDays(reservation.date, SEED_ANCHOR_DATE)
      expect(offset).toBeGreaterThanOrEqual(-30)
      expect(offset).toBeLessThanOrEqual(30)
    }
  })

  it('4種のステータスをすべて含む', () => {
    const statuses = new Set(createSeedReservations().map((reservation) => reservation.status))
    for (const status of RESERVATION_STATUSES) {
      expect(statuses).toContain(status)
    }
  })

  it('既存のスタジオのみを参照する', () => {
    const studioIds = STUDIOS.map((studio) => studio.id)
    for (const reservation of createSeedReservations()) {
      expect(studioIds).toContain(reservation.studioId)
    }
  })

  it('同一スタジオ・同一日で時間帯が重複しない', () => {
    const seen = new Map<string, { startHour: number; hours: number }[]>()
    for (const reservation of createSeedReservations()) {
      const key = `${reservation.studioId}:${reservation.date}`
      const slots = seen.get(key) ?? []
      for (const slot of slots) {
        const overlapped =
          slot.startHour < reservation.startHour + reservation.hours &&
          reservation.startHour < slot.startHour + slot.hours
        expect(overlapped).toBe(false)
      }
      slots.push({ startHour: reservation.startHour, hours: reservation.hours })
      seen.set(key, slots)
    }
  })

  it('連絡先は架空の値である', () => {
    for (const reservation of createSeedReservations()) {
      expect(reservation.customerTel).toMatch(/^090-0000-\d{4}$/)
      expect(reservation.customerEmail).toMatch(/@example\.com$/)
    }
  })
})

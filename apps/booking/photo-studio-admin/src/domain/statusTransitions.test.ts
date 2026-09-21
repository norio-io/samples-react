import { describe, expect, it } from 'vitest'
import {
  canTransition,
  isIrreversible,
  nextStatuses,
  STATUS_ACTION_LABELS,
  STATUS_TRANSITIONS,
} from './statusTransitions'
import { RESERVATION_STATUSES } from './types'

describe('ステータスの遷移規則', () => {
  it('仕様どおりの遷移先を持つ', () => {
    expect(nextStatuses('tentative')).toEqual(['confirmed', 'cancelled'])
    expect(nextStatuses('confirmed')).toEqual(['completed', 'cancelled'])
    expect(nextStatuses('completed')).toEqual([])
    expect(nextStatuses('cancelled')).toEqual([])
  })

  it('すべてのステータスについて定義がある', () => {
    for (const status of RESERVATION_STATUSES) {
      expect(STATUS_TRANSITIONS[status]).toBeDefined()
      expect(STATUS_ACTION_LABELS[status]).not.toBe('')
    }
  })

  it('遷移先は既知のステータスのみとする', () => {
    for (const status of RESERVATION_STATUSES) {
      for (const next of STATUS_TRANSITIONS[status]) {
        expect(RESERVATION_STATUSES).toContain(next)
      }
    }
  })

  it('自身への遷移は認めない', () => {
    for (const status of RESERVATION_STATUSES) {
      expect(canTransition(status, status)).toBe(false)
    }
  })

  it('canTransition が規則と一致する', () => {
    expect(canTransition('tentative', 'confirmed')).toBe(true)
    expect(canTransition('tentative', 'completed')).toBe(false)
    expect(canTransition('confirmed', 'completed')).toBe(true)
    expect(canTransition('completed', 'cancelled')).toBe(false)
    expect(canTransition('cancelled', 'confirmed')).toBe(false)
  })

  it('キャンセルのみ確認を要する', () => {
    expect(isIrreversible('cancelled')).toBe(true)
    expect(isIrreversible('confirmed')).toBe(false)
    expect(isIrreversible('completed')).toBe(false)
  })
})

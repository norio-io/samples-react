import { describe, expect, it } from 'vitest'
import { formatTel, normalizeTel } from './tel'

describe('normalizeTel', () => {
  it('数字以外を取り除く', () => {
    expect(normalizeTel('090-0000-1000')).toBe('09000001000')
    expect(normalizeTel('090 0000 1000')).toBe('09000001000')
    expect(normalizeTel('(03)1234-5678')).toBe('0312345678')
    expect(normalizeTel('09000001000')).toBe('09000001000')
  })
})

describe('formatTel', () => {
  it('携帯番号は3-4-4で整形する', () => {
    expect(formatTel('09000001000')).toBe('090-0000-1000')
  })

  it('固定電話は2-4-4で整形する', () => {
    expect(formatTel('0312345678')).toBe('03-1234-5678')
  })

  it('桁数が想定外の場合はそのまま返す', () => {
    expect(formatTel('123')).toBe('123')
    expect(formatTel('')).toBe('')
  })
})

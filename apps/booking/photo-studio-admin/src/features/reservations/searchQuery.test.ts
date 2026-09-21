import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SEARCH,
  parseSearch,
  toListQuery,
  toSearchParams,
  toggleSort,
  type ReservationSearch,
} from './searchQuery'

function parse(queryString: string): ReservationSearch {
  return parseSearch(new URLSearchParams(queryString))
}

describe('parseSearch', () => {
  it('パラメータがない場合は既定値を返す', () => {
    expect(parse('')).toEqual(DEFAULT_SEARCH)
  })

  it('指定された条件をすべて読み取る', () => {
    expect(
      parse('from=2026-09-01&to=2026-09-30&studio=studio-a,studio-h&status=confirmed,cancelled&q=相川&sort=studio&order=desc&page=3'),
    ).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      studioIds: ['studio-a', 'studio-h'],
      statuses: ['confirmed', 'cancelled'],
      keyword: '相川',
      sort: 'studio',
      order: 'desc',
      page: 3,
    })
  })

  it('スタジオおよびステータスは定義順で一意化する', () => {
    const search = parse('studio=studio-h,studio-a,studio-a&status=cancelled,tentative')
    expect(search.studioIds).toEqual(['studio-a', 'studio-h'])
    expect(search.statuses).toEqual(['tentative', 'cancelled'])
  })

  it('不正な日付は未指定として扱う', () => {
    expect(parse('from=2026-9-1&to=2026-02-31').from).toBe('')
    expect(parse('from=2026-9-1&to=2026-02-31').to).toBe('')
    expect(parse('from=yesterday').from).toBe('')
  })

  it('未知のスタジオ・ステータスは取り除く', () => {
    expect(parse('studio=studio-x,studio-a').studioIds).toEqual(['studio-a'])
    expect(parse('status=unknown').statuses).toEqual([])
  })

  it('不正な並び替え・並び順・ページ番号は既定値へフォールバックする', () => {
    const search = parse('sort=customerName&order=descending&page=0')
    expect(search.sort).toBe(DEFAULT_SEARCH.sort)
    expect(search.order).toBe(DEFAULT_SEARCH.order)
    expect(search.page).toBe(DEFAULT_SEARCH.page)
    expect(parse('page=-2').page).toBe(1)
    expect(parse('page=1.5').page).toBe(1)
    expect(parse('page=abc').page).toBe(1)
  })

  it('未知のパラメータは無視する', () => {
    expect(parse('unknown=1&%%%=2&page=2').page).toBe(2)
  })
})

describe('toSearchParams', () => {
  it('既定値と同一の項目は出力しない', () => {
    expect(toSearchParams(DEFAULT_SEARCH).toString()).toBe('')
  })

  it('指定された条件のみを出力する', () => {
    const params = toSearchParams({
      ...DEFAULT_SEARCH,
      from: '2026-09-01',
      studioIds: ['studio-a', 'studio-b'],
      statuses: ['tentative'],
      keyword: '相川',
      order: 'desc',
      page: 2,
    })
    expect(params.get('from')).toBe('2026-09-01')
    expect(params.get('to')).toBeNull()
    expect(params.get('studio')).toBe('studio-a,studio-b')
    expect(params.get('status')).toBe('tentative')
    expect(params.get('q')).toBe('相川')
    expect(params.get('sort')).toBeNull()
    expect(params.get('order')).toBe('desc')
    expect(params.get('page')).toBe('2')
  })

  it('往復しても条件が変わらない', () => {
    const search: ReservationSearch = {
      from: '2026-09-01',
      to: '2026-10-01',
      studioIds: ['studio-b'],
      statuses: ['confirmed', 'completed'],
      keyword: '商品撮影',
      sort: 'status',
      order: 'desc',
      page: 4,
    }
    expect(parseSearch(toSearchParams(search))).toEqual(search)
  })
})

describe('toListQuery', () => {
  it('未指定の条件は問い合わせへ含めない', () => {
    const query = toListQuery(DEFAULT_SEARCH)
    expect(query).toEqual({ sort: { field: 'date', direction: 'asc' }, page: 1, perPage: 20 })
  })

  it('指定された条件を問い合わせへ渡す', () => {
    const query = toListQuery({
      ...DEFAULT_SEARCH,
      from: '2026-09-01',
      to: '2026-09-30',
      studioIds: ['studio-a'],
      statuses: ['tentative'],
      keyword: '相川',
      sort: 'studio',
      order: 'desc',
      page: 2,
    })
    expect(query).toEqual({
      sort: { field: 'studio', direction: 'desc' },
      page: 2,
      perPage: 20,
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      studioIds: ['studio-a'],
      statuses: ['tentative'],
      keyword: '相川',
    })
  })
})

describe('toggleSort', () => {
  it('同一列では昇順と降順を入れ替える', () => {
    const asc = { ...DEFAULT_SEARCH, sort: 'date', order: 'asc', page: 3 } as ReservationSearch
    expect(toggleSort(asc, 'date')).toMatchObject({ sort: 'date', order: 'desc', page: 1 })
    expect(toggleSort(toggleSort(asc, 'date'), 'date')).toMatchObject({
      sort: 'date',
      order: 'asc',
    })
  })

  it('別の列では昇順から始める', () => {
    const desc = { ...DEFAULT_SEARCH, sort: 'date', order: 'desc' } as ReservationSearch
    expect(toggleSort(desc, 'studio')).toMatchObject({ sort: 'studio', order: 'asc', page: 1 })
  })
})

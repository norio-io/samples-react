import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RESERVATION_STATUSES,
  type ReservationDraft,
  type ReservationStatus,
} from '../domain/types'
import {
  createReservation,
  DEFAULT_PER_PAGE,
  getReservation,
  listReservations,
  listStudios,
  resetMockStore,
  updateReservationStatus,
  type ReservationListQuery,
} from './api'
import { resetMutationFailureRate, setMutationFailureRate } from './config'
import { createSeedReservations, SEED_ANCHOR_DATE, SEED_RESERVATION_COUNT, STUDIOS } from './seed'

/** 応答遅延をタイマーごと進め、結果を取り出す。 */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync()
  return promise
}

function list(query: ReservationListQuery = {}) {
  return settle(listReservations(query))
}

async function listAll(query: ReservationListQuery = {}) {
  const result = await list({ ...query, perPage: SEED_RESERVATION_COUNT * 2 })
  if (!result.ok) throw new Error('一覧取得に失敗しました')
  return result.value
}

const DRAFT: ReservationDraft = {
  studioId: 'studio-a',
  date: '2027-01-15',
  startHour: 13,
  hours: 2,
  customerName: '検証 太郎',
  customerTel: '090-0000-9999',
  customerEmail: 'test@example.com',
  purpose: '商品撮影',
  status: 'tentative',
}

beforeEach(() => {
  vi.useFakeTimers()
  resetMockStore()
  // 既定では確率的に失敗するため、テストでは明示的に固定する。
  setMutationFailureRate(0)
})

afterEach(() => {
  vi.useRealTimers()
  resetMutationFailureRate()
})

describe('listReservations', () => {
  it('既定でページングを適用し、総件数を返す', async () => {
    const result = await list()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.total).toBe(SEED_RESERVATION_COUNT)
    expect(result.value.items).toHaveLength(DEFAULT_PER_PAGE)
    expect(result.value.page).toBe(1)
    expect(result.value.totalPages).toBe(SEED_RESERVATION_COUNT / DEFAULT_PER_PAGE)
  })

  it('ページ番号に応じて異なる範囲を返す', async () => {
    const first = await list({ perPage: 10, page: 1 })
    const second = await list({ perPage: 10, page: 2 })
    if (!first.ok || !second.ok) throw new Error('一覧取得に失敗しました')
    expect(first.value.items).toHaveLength(10)
    expect(second.value.items).toHaveLength(10)
    expect(second.value.items[0]?.id).not.toBe(first.value.items[0]?.id)
  })

  it('総ページ数を超えるページ番号は最終ページに丸める', async () => {
    const result = await list({ perPage: 10, page: 99 })
    if (!result.ok) throw new Error('一覧取得に失敗しました')
    expect(result.value.page).toBe(result.value.totalPages)
    expect(result.value.items.length).toBeGreaterThan(0)
  })

  it('スタジオで絞り込む', async () => {
    const { items, total } = await listAll({ studioIds: ['studio-b'] })
    expect(total).toBeGreaterThan(0)
    expect(total).toBeLessThan(SEED_RESERVATION_COUNT)
    expect(items.every((item) => item.studioId === 'studio-b')).toBe(true)
  })

  it('スタジオを複数指定して絞り込む', async () => {
    const { items, total } = await listAll({ studioIds: ['studio-a', 'studio-h'] })
    expect(total).toBeGreaterThan(0)
    expect(total).toBeLessThan(SEED_RESERVATION_COUNT)
    expect(items.every((item) => item.studioId !== 'studio-b')).toBe(true)
  })

  it('ステータスで絞り込む', async () => {
    const { items, total } = await listAll({ statuses: ['tentative', 'cancelled'] })
    expect(total).toBe(items.length)
    expect(items.every((item) => item.status === 'tentative' || item.status === 'cancelled')).toBe(
      true,
    )
  })

  it('日付の範囲で絞り込む（両端を含む）', async () => {
    const { items } = await listAll({ dateFrom: SEED_ANCHOR_DATE, dateTo: SEED_ANCHOR_DATE })
    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.date === SEED_ANCHOR_DATE)).toBe(true)
  })

  it('キーワードで顧客名・連絡先・目的を部分一致検索する', async () => {
    const all = await listAll()
    const target = all.items[0]
    if (target === undefined) throw new Error('初期データがありません')

    const byEmail = await listAll({ keyword: target.customerEmail })
    expect(byEmail.items.map((item) => item.id)).toContain(target.id)

    const byPurpose = await listAll({ keyword: target.purpose })
    expect(byPurpose.items.every((item) => item.purpose.includes(target.purpose))).toBe(true)

    const unmatched = await listAll({ keyword: '該当しない文字列' })
    expect(unmatched.total).toBe(0)
  })

  it('絞り込み条件を併用できる', async () => {
    const { items } = await listAll({ studioIds: ['studio-a'], statuses: ['completed'] })
    expect(items.every((item) => item.studioId === 'studio-a' && item.status === 'completed')).toBe(
      true,
    )
  })

  it('日付の昇順・降順で並び替える', async () => {
    const asc = await listAll({ sort: { field: 'date', direction: 'asc' } })
    const desc = await listAll({ sort: { field: 'date', direction: 'desc' } })
    const ascDates = asc.items.map((item) => item.date)
    expect([...ascDates].sort()).toEqual(ascDates)
    expect(desc.items[0]?.date).toBe(ascDates[ascDates.length - 1])
  })

  it('スタジオおよびステータスの定義順で並び替える', async () => {
    const byStudio = await listAll({ sort: { field: 'studio', direction: 'asc' } })
    const studioOrder = STUDIOS.map((studio) => studio.id)
    const ranks = byStudio.items.map((item) => studioOrder.indexOf(item.studioId))
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)

    const byStatus = await listAll({ sort: { field: 'status', direction: 'asc' } })
    const statusRanks = byStatus.items.map((item) => RESERVATION_STATUSES.indexOf(item.status))
    expect([...statusRanks].sort((a, b) => a - b)).toEqual(statusRanks)
  })

  it('顧客名で並び替える', async () => {
    const { items } = await listAll({ sort: { field: 'customerName', direction: 'asc' } })
    const names = items.map((item) => item.customerName)
    expect([...names].sort((a, b) => a.localeCompare(b, 'ja'))).toEqual(names)
  })

  it('同一条件では常に同じ並びを返す', async () => {
    const first = await listAll({ sort: { field: 'createdAt', direction: 'desc' } })
    const second = await listAll({ sort: { field: 'createdAt', direction: 'desc' } })
    expect(first.items).toEqual(second.items)
  })
})

describe('getReservation', () => {
  it('id を指定して詳細を取得する', async () => {
    const result = await settle(getReservation('rsv-001'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.id).toBe('rsv-001')
  })

  it('存在しない id では NOT_FOUND を返す', async () => {
    const result = await settle(getReservation('rsv-999'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })
})

describe('updateReservationStatus', () => {
  /** 指定のステータスを持つ初期データの id を返す。 */
  function idOfStatus(status: ReservationStatus): string {
    const found = createSeedReservations().find((reservation) => reservation.status === status)
    if (found === undefined) throw new Error(`初期データに ${status} の予約がありません`)
    return found.id
  }

  it('遷移規則で認められたステータスへ更新する', async () => {
    const id = idOfStatus('tentative')
    const result = await settle(updateReservationStatus(id, 'confirmed'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.status).toBe('confirmed')

    const reloaded = await settle(getReservation(id))
    expect(reloaded.ok && reloaded.value.status).toBe('confirmed')
  })

  it('遷移規則で認められていない変更は INVALID_TRANSITION を返す', async () => {
    const id = idOfStatus('completed')
    const result = await settle(updateReservationStatus(id, 'confirmed'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('INVALID_TRANSITION')
    // 文言は内部の識別子ではなく利用者向けの表記とする。
    expect(result.error.message).toBe('完了から確定への変更は認められていません。')

    const reloaded = await settle(getReservation(id))
    expect(reloaded.ok && reloaded.value.status).toBe('completed')
  })

  it('失敗確率を 1 に固定すると、例外ではなく失敗結果を返し、データを変更しない', async () => {
    const before = await settle(getReservation('rsv-002'))
    setMutationFailureRate(1)

    const result = await settle(updateReservationStatus('rsv-002', 'cancelled'))
    // 失敗は遷移規則の判定よりも先に返る。
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('TEMPORARY_FAILURE')

    setMutationFailureRate(0)
    const after = await settle(getReservation('rsv-002'))
    expect(after).toEqual(before)
  })

  it('存在しない id では NOT_FOUND を返す', async () => {
    const result = await settle(updateReservationStatus('rsv-999', 'confirmed'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('NOT_FOUND')
  })
})

describe('createReservation', () => {
  it('予約を登録し、一覧の件数が増える', async () => {
    const result = await settle(createReservation(DRAFT))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.id).not.toBe('')
    expect(result.value.createdAt).not.toBe('')

    const { total } = await listAll()
    expect(total).toBe(SEED_RESERVATION_COUNT + 1)
  })

  it('同一スタジオ・同一時間帯の登録は DUPLICATED を返す', async () => {
    const created = await settle(createReservation(DRAFT))
    expect(created.ok).toBe(true)

    const duplicated = await settle(createReservation({ ...DRAFT, startHour: DRAFT.startHour + 1 }))
    expect(duplicated.ok).toBe(false)
    if (duplicated.ok) return
    expect(duplicated.error.code).toBe('DUPLICATED')
  })

  it('別スタジオであれば同一時間帯でも登録できる', async () => {
    await settle(createReservation(DRAFT))
    const another = await settle(createReservation({ ...DRAFT, studioId: 'studio-b' }))
    expect(another.ok).toBe(true)
  })

  it('失敗確率を 1 に固定すると失敗結果を返し、件数が増えない', async () => {
    setMutationFailureRate(1)
    const result = await settle(createReservation(DRAFT))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('TEMPORARY_FAILURE')

    setMutationFailureRate(0)
    const { total } = await listAll()
    expect(total).toBe(SEED_RESERVATION_COUNT)
  })
})

describe('listStudios', () => {
  it('絞り込みの選択肢となるスタジオ一覧を返す', async () => {
    const result = await settle(listStudios())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.map((studio) => studio.id)).toEqual(STUDIOS.map((studio) => studio.id))
  })
})

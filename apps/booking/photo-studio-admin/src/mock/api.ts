import {
  RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS,
  type Reservation,
  type ReservationDraft,
  type ReservationStatus,
  type Studio,
} from '../domain/types'
import { canTransition } from '../domain/statusTransitions'
import { formatTel } from '../domain/tel'
import { delay, shouldFailMutation } from './config'
import { fail, ok, type Result } from './result'
import { createSeedReservations, STUDIOS } from './seed'

export type ReservationSortField = 'date' | 'studio' | 'status' | 'customerName' | 'createdAt'
export type SortDirection = 'asc' | 'desc'

export interface ReservationSort {
  field: ReservationSortField
  direction: SortDirection
}

export interface ReservationListQuery {
  /** 指定がない場合はすべてのスタジオを対象とする。 */
  studioIds?: readonly string[]
  /** 指定がない場合はすべてのステータスを対象とする。 */
  statuses?: readonly ReservationStatus[]
  /** YYYY-MM-DD。指定日を含む。 */
  dateFrom?: string
  /** YYYY-MM-DD。指定日を含む。 */
  dateTo?: string
  /** 顧客名・電話番号・メールアドレス・利用目的を対象とした部分一致。 */
  keyword?: string
  sort?: ReservationSort
  /** 1 始まり。 */
  page?: number
  perPage?: number
}

export interface ReservationListResult {
  items: Reservation[]
  /** 絞り込み後の総件数（ページング前）。 */
  total: number
  page: number
  perPage: number
  totalPages: number
}

export const DEFAULT_PER_PAGE = 20

const DEFAULT_SORT: ReservationSort = { field: 'date', direction: 'asc' }

let reservations: Reservation[] = createSeedReservations()

/** テストおよび画面の再初期化で用いる。保持データを初期状態へ戻す。 */
export function resetMockStore(): void {
  reservations = createSeedReservations()
}

function clone(reservation: Reservation): Reservation {
  return { ...reservation }
}

function matches(reservation: Reservation, query: ReservationListQuery): boolean {
  if (query.studioIds !== undefined && query.studioIds.length > 0) {
    if (!query.studioIds.includes(reservation.studioId)) return false
  }
  if (query.statuses !== undefined && query.statuses.length > 0) {
    if (!query.statuses.includes(reservation.status)) return false
  }
  if (query.dateFrom !== undefined && reservation.date < query.dateFrom) return false
  if (query.dateTo !== undefined && reservation.date > query.dateTo) return false
  if (query.keyword !== undefined && query.keyword.trim() !== '') {
    const keyword = query.keyword.trim().toLowerCase()
    const haystack = [
      reservation.customerName,
      // 電話番号は保存値と表示形式のどちらでも引けるようにする。
      reservation.customerTel,
      formatTel(reservation.customerTel),
      reservation.customerEmail,
      reservation.purpose,
    ]
      .join('\n')
      .toLowerCase()
    if (!haystack.includes(keyword)) return false
  }
  return true
}

/** スタジオおよびステータスは、定義された並び順を序列として用いる。 */
function studioRank(studioId: string): number {
  const index = STUDIOS.findIndex((studio) => studio.id === studioId)
  return index < 0 ? STUDIOS.length : index
}

function statusRank(status: ReservationStatus): number {
  const index = RESERVATION_STATUSES.indexOf(status)
  return index < 0 ? RESERVATION_STATUSES.length : index
}

function compare(a: Reservation, b: Reservation, sort: ReservationSort): number {
  const order = sort.direction === 'desc' ? -1 : 1
  // すべての分岐で値を定めるため、初期値は置かない。
  let result: number
  if (sort.field === 'date') {
    result = a.date.localeCompare(b.date) || a.startHour - b.startHour
  } else if (sort.field === 'studio') {
    result = studioRank(a.studioId) - studioRank(b.studioId)
  } else if (sort.field === 'status') {
    result = statusRank(a.status) - statusRank(b.status)
  } else if (sort.field === 'createdAt') {
    result = a.createdAt.localeCompare(b.createdAt)
  } else {
    result = a.customerName.localeCompare(b.customerName, 'ja')
  }
  // 並び順を一意に定めるため、同値は id で解決する。
  return result === 0 ? a.id.localeCompare(b.id) : result * order
}

function overlaps(a: Reservation, b: Pick<Reservation, 'startHour' | 'hours'>): boolean {
  return a.startHour < b.startHour + b.hours && b.startHour < a.startHour + a.hours
}

/** 予約一覧を取得する。絞り込み・並び替え・ページングを適用した結果と総件数を返す。 */
export async function listReservations(
  query: ReservationListQuery = {},
): Promise<Result<ReservationListResult>> {
  await delay()

  const sort = query.sort ?? DEFAULT_SORT
  const perPage = Math.max(1, query.perPage ?? DEFAULT_PER_PAGE)
  const filtered = reservations.filter((reservation) => matches(reservation, query))
  const sorted = [...filtered].sort((a, b) => compare(a, b, sort))
  const total = sorted.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const page = Math.min(Math.max(1, query.page ?? 1), totalPages)
  const start = (page - 1) * perPage

  return ok({
    items: sorted.slice(start, start + perPage).map(clone),
    total,
    page,
    perPage,
    totalPages,
  })
}

/** 予約の詳細を取得する。 */
export async function getReservation(id: string): Promise<Result<Reservation>> {
  await delay()

  const found = reservations.find((reservation) => reservation.id === id)
  if (found === undefined) {
    return fail('NOT_FOUND', `予約が見つかりません: ${id}`)
  }
  return ok(clone(found))
}

/** 予約のステータスを更新する。 */
export async function updateReservationStatus(
  id: string,
  status: ReservationStatus,
): Promise<Result<Reservation>> {
  await delay()

  if (shouldFailMutation()) {
    return fail('TEMPORARY_FAILURE', 'ステータスを更新できませんでした。再度お試しください。')
  }

  const index = reservations.findIndex((reservation) => reservation.id === id)
  const current = reservations[index]
  if (index < 0 || current === undefined) {
    return fail('NOT_FOUND', `予約が見つかりません: ${id}`)
  }

  // 遷移規則は画面と共通の定義を参照する。
  if (!canTransition(current.status, status)) {
    return fail(
      'INVALID_TRANSITION',
      `${RESERVATION_STATUS_LABELS[current.status]}から${RESERVATION_STATUS_LABELS[status]}への変更は認められていません。`,
    )
  }

  const updated: Reservation = { ...current, status }
  reservations[index] = updated
  return ok(clone(updated))
}

/** 予約を登録する。同一スタジオ・同一時間帯に既存の予約がある場合は重複として返す。 */
export async function createReservation(draft: ReservationDraft): Promise<Result<Reservation>> {
  await delay()

  if (shouldFailMutation()) {
    return fail('TEMPORARY_FAILURE', '予約を登録できませんでした。再度お試しください。')
  }

  // 重複判定は画面側の検証に依存せず、ここでも必ず行う。
  // キャンセル済みの予約は重複と見なさない。
  const conflicts = reservations.filter(
    (reservation) =>
      reservation.status !== 'cancelled' &&
      reservation.studioId === draft.studioId &&
      reservation.date === draft.date &&
      overlaps(reservation, draft),
  )
  if (conflicts.length > 0) {
    return fail('DUPLICATED', '指定の日時は既に予約されています。', {
      conflicts: conflicts.map(clone),
    })
  }

  const created: Reservation = {
    ...draft,
    id: nextReservationId(),
    createdAt: new Date().toISOString(),
  }
  reservations = [...reservations, created]
  return ok(clone(created))
}

/** 絞り込みの選択肢に用いるスタジオ一覧を取得する。 */
export async function listStudios(): Promise<Result<Studio[]>> {
  await delay()
  return ok(STUDIOS.map((studio) => ({ ...studio })))
}

function nextReservationId(): string {
  const maxNumber = reservations.reduce((max, reservation) => {
    const parsed = Number(reservation.id.replace('rsv-', ''))
    return Number.isNaN(parsed) ? max : Math.max(max, parsed)
  }, 0)
  return `rsv-${String(maxNumber + 1).padStart(3, '0')}`
}

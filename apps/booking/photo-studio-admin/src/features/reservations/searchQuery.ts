import { parseDate } from '../../domain/date'
import { RESERVATION_STATUSES, type ReservationStatus } from '../../domain/types'
import { DEFAULT_PER_PAGE, type ReservationListQuery, type SortDirection } from '../../mock/api'
import { STUDIOS } from '../../mock/seed'

/**
 * 一覧画面の検索条件。絞り込み・並び順・ページ番号のすべてをクエリパラメータへ
 * 保持し、再読み込み・履歴の移動・URLの共有のいずれでも同一の結果を復元する。
 */

/** 一覧で並び替えの対象とする列。 */
export const LIST_SORT_FIELDS = ['date', 'studio', 'status'] as const
export type ListSortField = (typeof LIST_SORT_FIELDS)[number]

export const LIST_SORT_LABELS: Record<ListSortField, string> = {
  date: '日付',
  studio: 'スタジオ',
  status: 'ステータス',
}

export interface ReservationSearch {
  /** YYYY-MM-DD。空文字は未指定。 */
  from: string
  /** YYYY-MM-DD。空文字は未指定。 */
  to: string
  studioIds: string[]
  statuses: ReservationStatus[]
  /** 顧客名・電話番号・メールアドレス・利用目的を対象とした部分一致。 */
  keyword: string
  sort: ListSortField
  order: SortDirection
  /** 1 始まり。 */
  page: number
}

export const DEFAULT_SEARCH: ReservationSearch = {
  from: '',
  to: '',
  studioIds: [],
  statuses: [],
  keyword: '',
  sort: 'date',
  order: 'asc',
  page: 1,
}

export const SEARCH_PARAM_KEYS = {
  from: 'from',
  to: 'to',
  studio: 'studio',
  status: 'status',
  keyword: 'q',
  sort: 'sort',
  order: 'order',
  page: 'page',
} as const

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseDateParam(value: string | null): string {
  if (value === null || !DATE_PATTERN.test(value)) return ''
  try {
    // 2026-02-31 のような存在しない日付を弾く。
    const parsed = parseDate(value)
    return parsed.toISOString().slice(0, 10) === value ? value : ''
  } catch {
    return ''
  }
}

/** カンマ区切りの値を、既知の値のみへ絞り込み、定義順で一意化する。 */
function parseList<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (value === null) return []
  const given = new Set(value.split(','))
  return allowed.filter((candidate) => given.has(candidate))
}

function parsePage(value: string | null): number {
  if (value === null || !/^\d+$/.test(value)) return DEFAULT_SEARCH.page
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 ? page : DEFAULT_SEARCH.page
}

/**
 * クエリパラメータを検索条件へ変換する。
 * 不正な値および未知のパラメータは無視し、既定値へフォールバックする。
 */
export function parseSearch(params: URLSearchParams): ReservationSearch {
  const sort = params.get(SEARCH_PARAM_KEYS.sort)
  const order = params.get(SEARCH_PARAM_KEYS.order)
  const studioIds = STUDIOS.map((studio) => studio.id)

  return {
    from: parseDateParam(params.get(SEARCH_PARAM_KEYS.from)),
    to: parseDateParam(params.get(SEARCH_PARAM_KEYS.to)),
    studioIds: parseList(params.get(SEARCH_PARAM_KEYS.studio), studioIds),
    statuses: parseList(params.get(SEARCH_PARAM_KEYS.status), RESERVATION_STATUSES),
    keyword: params.get(SEARCH_PARAM_KEYS.keyword)?.trim() ?? DEFAULT_SEARCH.keyword,
    sort: LIST_SORT_FIELDS.find((field) => field === sort) ?? DEFAULT_SEARCH.sort,
    order: order === 'asc' || order === 'desc' ? order : DEFAULT_SEARCH.order,
    page: parsePage(params.get(SEARCH_PARAM_KEYS.page)),
  }
}

/** 検索条件をクエリパラメータへ変換する。既定値と同一の項目は出力しない。 */
export function toSearchParams(search: ReservationSearch): URLSearchParams {
  const params = new URLSearchParams()
  if (search.from !== '') params.set(SEARCH_PARAM_KEYS.from, search.from)
  if (search.to !== '') params.set(SEARCH_PARAM_KEYS.to, search.to)
  if (search.studioIds.length > 0) {
    params.set(SEARCH_PARAM_KEYS.studio, search.studioIds.join(','))
  }
  if (search.statuses.length > 0) {
    params.set(SEARCH_PARAM_KEYS.status, search.statuses.join(','))
  }
  if (search.keyword !== '') params.set(SEARCH_PARAM_KEYS.keyword, search.keyword)
  if (search.sort !== DEFAULT_SEARCH.sort) params.set(SEARCH_PARAM_KEYS.sort, search.sort)
  if (search.order !== DEFAULT_SEARCH.order) params.set(SEARCH_PARAM_KEYS.order, search.order)
  if (search.page !== DEFAULT_SEARCH.page) params.set(SEARCH_PARAM_KEYS.page, String(search.page))
  return params
}

/** 検索条件をモックAPIの問い合わせへ変換する。 */
export function toListQuery(search: ReservationSearch): ReservationListQuery {
  const query: ReservationListQuery = {
    sort: { field: search.sort, direction: search.order },
    page: search.page,
    perPage: DEFAULT_PER_PAGE,
  }
  if (search.from !== '') query.dateFrom = search.from
  if (search.to !== '') query.dateTo = search.to
  if (search.studioIds.length > 0) query.studioIds = search.studioIds
  if (search.statuses.length > 0) query.statuses = search.statuses
  if (search.keyword !== '') query.keyword = search.keyword
  return query
}

/**
 * 並び替えの指定を切り替える。同一列であれば昇順と降順を入れ替え、
 * 別の列であれば昇順から始める。並び順の変更はページを先頭へ戻す。
 */
export function toggleSort(search: ReservationSearch, field: ListSortField): ReservationSearch {
  const order: SortDirection = search.sort === field && search.order === 'asc' ? 'desc' : 'asc'
  return { ...search, sort: field, order, page: DEFAULT_SEARCH.page }
}

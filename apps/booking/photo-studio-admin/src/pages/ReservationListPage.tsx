import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS,
  type Reservation,
  type Studio,
} from '../domain/types'
import { listReservations, listStudios, type ReservationListResult } from '../mock/api'
import {
  DEFAULT_SEARCH,
  LIST_SORT_FIELDS,
  LIST_SORT_LABELS,
  parseSearch,
  toListQuery,
  toSearchParams,
  toggleSort,
  type ListSortField,
  type ReservationSearch,
} from '../features/reservations/searchQuery'

/** 顧客名の入力を検索条件へ反映するまでの待ち時間（ms）。 */
const KEYWORD_DEBOUNCE_MS = 300

function formatTimeRange(reservation: Reservation): string {
  const end = reservation.startHour + reservation.hours
  return `${String(reservation.startHour).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00`
}

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

export function ReservationListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useMemo(() => parseSearch(searchParams), [searchParams])

  const [studios, setStudios] = useState<Studio[]>([])
  const [result, setResult] = useState<ReservationListResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [keywordInput, setKeywordInput] = useState(search.keyword)
  const lastAppliedKeyword = useRef(search.keyword)

  /**
   * 検索条件を更新する。絞り込みの変更およびページ遷移は履歴へ積む。
   * 顧客名の入力のみ replace とし、打鍵ごとに履歴が積まないようにする。
   */
  const updateSearch = useCallback(
    (next: ReservationSearch, options?: { replace?: boolean }) => {
      lastAppliedKeyword.current = next.keyword
      setSearchParams(toSearchParams(next), { replace: options?.replace ?? false })
    },
    [setSearchParams],
  )

  useEffect(() => {
    let cancelled = false
    void listStudios().then((studioResult) => {
      if (!cancelled && studioResult.ok) setStudios(studioResult.value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void listReservations(toListQuery(search)).then((listResult) => {
      if (cancelled) return
      if (listResult.ok) {
        setResult(listResult.value)
        setErrorMessage('')
      } else {
        setErrorMessage(listResult.error.message)
      }
    })
    return () => {
      cancelled = true
    }
  }, [search])

  // 履歴の移動などで外部から条件が変わった場合は、入力欄を追従させる。
  useEffect(() => {
    if (search.keyword !== lastAppliedKeyword.current) {
      lastAppliedKeyword.current = search.keyword
      setKeywordInput(search.keyword)
    }
  }, [search.keyword])

  useEffect(() => {
    if (keywordInput === search.keyword) return
    const timer = setTimeout(() => {
      updateSearch({ ...search, keyword: keywordInput, page: DEFAULT_SEARCH.page }, { replace: true })
    }, KEYWORD_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [keywordInput, search, updateSearch])

  const studioName = useCallback(
    (studioId: string) => studios.find((studio) => studio.id === studioId)?.name ?? studioId,
    [studios],
  )

  const items = result?.items ?? []
  const total = result?.total ?? 0
  const firstIndex = total === 0 ? 0 : (search.page - 1) * (result?.perPage ?? 0) + 1
  const lastIndex = total === 0 ? 0 : firstIndex + items.length - 1

  return (
    <section className="list">
      <h1>予約一覧</h1>

      <form className="filters" onSubmit={(event) => event.preventDefault()}>
        <div className="filters__row">
          <label className="field">
            <span className="field__label">開始日</span>
            <input
              type="date"
              value={search.from}
              onChange={(event) =>
                updateSearch({ ...search, from: event.target.value, page: DEFAULT_SEARCH.page })
              }
            />
          </label>
          <label className="field">
            <span className="field__label">終了日</span>
            <input
              type="date"
              value={search.to}
              onChange={(event) =>
                updateSearch({ ...search, to: event.target.value, page: DEFAULT_SEARCH.page })
              }
            />
          </label>
          <label className="field field--grow">
            <span className="field__label">顧客名</span>
            <input
              type="search"
              value={keywordInput}
              placeholder="顧客名・連絡先・用途"
              onChange={(event) => setKeywordInput(event.target.value)}
            />
          </label>
        </div>

        <fieldset className="filters__group">
          <legend>スタジオ</legend>
          {studios.map((studio) => (
            <label key={studio.id} className="choice">
              <input
                type="checkbox"
                checked={search.studioIds.includes(studio.id)}
                onChange={() =>
                  updateSearch({
                    ...search,
                    studioIds: toggleValue(search.studioIds, studio.id),
                    page: DEFAULT_SEARCH.page,
                  })
                }
              />
              {studio.name}
            </label>
          ))}
        </fieldset>

        <fieldset className="filters__group">
          <legend>ステータス</legend>
          {RESERVATION_STATUSES.map((status) => (
            <label key={status} className="choice">
              <input
                type="checkbox"
                checked={search.statuses.includes(status)}
                onChange={() =>
                  updateSearch({
                    ...search,
                    statuses: toggleValue(search.statuses, status),
                    page: DEFAULT_SEARCH.page,
                  })
                }
              />
              {RESERVATION_STATUS_LABELS[status]}
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          className="filters__reset"
          onClick={() => updateSearch(DEFAULT_SEARCH)}
        >
          条件をリセット
        </button>
      </form>

      {errorMessage !== '' && <p role="alert">{errorMessage}</p>}

      <p className="summary">
        {total === 0 ? '該当する予約はありません' : `${total}件中 ${firstIndex}–${lastIndex}件`}
      </p>

      <table className="table">
        <thead>
          <tr>
            {LIST_SORT_FIELDS.map((field) => (
              <SortableHeader
                key={field}
                field={field}
                search={search}
                onToggle={() => updateSearch(toggleSort(search, field))}
              />
            ))}
            <th scope="col">時間帯</th>
            <th scope="col">顧客名</th>
            <th scope="col">用途</th>
          </tr>
        </thead>
        <tbody>
          {items.map((reservation) => (
            <tr key={reservation.id}>
              <td>
                <Link to={`/reservations/${reservation.id}`}>{reservation.date}</Link>
              </td>
              <td>{studioName(reservation.studioId)}</td>
              <td>{RESERVATION_STATUS_LABELS[reservation.status]}</td>
              <td>{formatTimeRange(reservation)}</td>
              <td>{reservation.customerName}</td>
              <td>{reservation.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <nav className="pager" aria-label="ページ送り">
        <button
          type="button"
          disabled={search.page <= 1}
          onClick={() => updateSearch({ ...search, page: search.page - 1 })}
        >
          前へ
        </button>
        <span>
          ページ {result?.page ?? search.page} / {result?.totalPages ?? 1}
        </span>
        <button
          type="button"
          disabled={result === null || search.page >= result.totalPages}
          onClick={() => updateSearch({ ...search, page: search.page + 1 })}
        >
          次へ
        </button>
      </nav>
    </section>
  )
}

function SortableHeader({
  field,
  search,
  onToggle,
}: {
  field: ListSortField
  search: ReservationSearch
  onToggle: () => void
}) {
  const isActive = search.sort === field
  const ariaSort = isActive ? (search.order === 'asc' ? 'ascending' : 'descending') : 'none'

  return (
    <th scope="col" aria-sort={ariaSort}>
      <button type="button" className="table__sort" onClick={onToggle}>
        {LIST_SORT_LABELS[field]}
        {isActive && <span aria-hidden="true">{search.order === 'asc' ? ' ▲' : ' ▼'}</span>}
      </button>
    </th>
  )
}

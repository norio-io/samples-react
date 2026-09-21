import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  RESERVATION_STATUSES,
  RESERVATION_STATUS_LABELS,
  type Reservation,
  type Studio,
} from '../domain/types'
import { DEFAULT_PER_PAGE, listStudios } from '../mock/api'
import {
  DEFAULT_SEARCH,
  LIST_SORT_FIELDS,
  LIST_SORT_LABELS,
  parseSearch,
  toDetailSearch,
  toSearchParams,
  toggleSort,
  type ListSortField,
  type ReservationSearch,
} from '../features/reservations/searchQuery'
import {
  effectiveStatus,
  useStatusOverrides,
} from '../features/reservations/statusOverridesContext'
import { useReservationList } from '../features/reservations/useReservationList'

/** キーワード入力を検索条件へ反映するまでの待ち時間（ms）。 */
const KEYWORD_DEBOUNCE_MS = 300

/** 一覧の列数。読込中のプレースホルダを一覧と同じ形状にするために用いる。 */
const COLUMN_COUNT = 6

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
  const [keywordInput, setKeywordInput] = useState(search.keyword)
  const lastAppliedKeyword = useRef(search.keyword)

  const { status, result, appliedSearch, errorMessage, retry } = useReservationList(search)
  const { overrides } = useStatusOverrides()

  // 詳細画面から一覧へ戻る際に検索条件を復元できるよう、現在の条件を引き渡す。
  const detailSearch = useMemo(() => toDetailSearch(searchParams.toString()), [searchParams])

  /**
   * 検索条件を更新する。絞り込みの変更およびページ遷移は履歴へ積む。
   * キーワードの入力のみ replace とし、打鍵ごとに履歴が積まないようにする。
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

  // 総件数は応答を受け取るまで分からないため、範囲外のページ番号は応答側で
  // 丸められる。URL を丸めた結果へ追従させ、表示・ページ送り・URL を一致させる。
  // 履歴は積まない。再取得中に保持している結果は現在の条件に対応しないため、
  // 結果とその取得時の条件が一致している場合のみ追従させる。
  useEffect(() => {
    if (result === null || appliedSearch !== search) return
    if (result.page !== search.page) {
      updateSearch({ ...search, page: result.page }, { replace: true })
    }
  }, [result, appliedSearch, search, updateSearch])

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
      updateSearch(
        { ...search, keyword: keywordInput, page: DEFAULT_SEARCH.page },
        { replace: true },
      )
    }, KEYWORD_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [keywordInput, search, updateSearch])

  const studioName = useCallback(
    (studioId: string) => studios.find((studio) => studio.id === studioId)?.name ?? studioId,
    [studios],
  )

  const isResultCurrent = result !== null && appliedSearch === search
  const isInitialLoading = status === 'loading'
  const isRefreshing = status === 'refreshing'
  const hasError = status === 'error'
  const isEmpty = !isInitialLoading && !hasError && result !== null && result.total === 0
  const hasFilter =
    search.from !== '' ||
    search.to !== '' ||
    search.studioIds.length > 0 ||
    search.statuses.length > 0 ||
    search.keyword !== ''

  const items = result?.items ?? []
  const total = result?.total ?? 0
  const totalPages = result?.totalPages ?? 1
  // 表示中の内容に対応するページ。範囲外のページ番号は応答側で丸められるため、
  // 件数およびページの表示は常に応答を基準とする。
  const displayedPage = result?.page ?? search.page
  // ページ送りの基準。再取得中に保持している結果は現在の条件に対応しないため、
  // その間は要求中のページ番号を基準とする。
  const targetPage = isResultCurrent ? displayedPage : search.page
  const firstIndex = total === 0 ? 0 : (displayedPage - 1) * (result?.perPage ?? 0) + 1
  const lastIndex = total === 0 ? 0 : firstIndex + items.length - 1

  const resetSearch = () => {
    setKeywordInput(DEFAULT_SEARCH.keyword)
    updateSearch(DEFAULT_SEARCH)
  }

  return (
    <section className="list">
      <div className="list__header">
        <h1>予約一覧</h1>
        <Link className="list__create" to="/reservations/new">
          予約を登録する
        </Link>
      </div>

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
            <span className="field__label">顧客名・連絡先・用途</span>
            <input
              type="search"
              value={keywordInput}
              placeholder="部分一致で検索"
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
          {RESERVATION_STATUSES.map((reservationStatus) => (
            <label key={reservationStatus} className="choice">
              <input
                type="checkbox"
                checked={search.statuses.includes(reservationStatus)}
                onChange={() =>
                  updateSearch({
                    ...search,
                    statuses: toggleValue(search.statuses, reservationStatus),
                    page: DEFAULT_SEARCH.page,
                  })
                }
              />
              {RESERVATION_STATUS_LABELS[reservationStatus]}
            </label>
          ))}
        </fieldset>

        <button type="button" className="filters__reset" onClick={resetSearch}>
          条件をリセット
        </button>
      </form>

      <p className="summary" aria-live="polite">
        {isInitialLoading && '読み込み中'}
        {hasError && '取得に失敗しました'}
        {!isInitialLoading && !hasError && (
          <>
            {total === 0 ? '該当する予約はありません' : `${total}件中 ${firstIndex}–${lastIndex}件`}
            {isRefreshing && <span className="summary__refreshing"> 更新中…</span>}
          </>
        )}
      </p>

      {hasError ? (
        <div className="notice">
          <p role="alert">{errorMessage}</p>
          <p className="notice__hint">検索条件はそのまま保持されます。</p>
          <button type="button" onClick={retry}>
            再試行
          </button>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table" aria-busy={isInitialLoading || isRefreshing}>
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
                {isInitialLoading
                  ? Array.from({ length: DEFAULT_PER_PAGE }, (_, index) => (
                      <tr key={index} className="table__skeleton" aria-hidden="true">
                        {Array.from({ length: COLUMN_COUNT }, (_, cellIndex) => (
                          <td key={cellIndex}>
                            <span className="skeleton" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : items.map((reservation) => (
                      <tr key={reservation.id}>
                        <td>
                          <Link
                            to={{
                              pathname: `/reservations/${reservation.id}`,
                              search: detailSearch,
                            }}
                          >
                            {reservation.date}
                          </Link>
                        </td>
                        <td>{studioName(reservation.studioId)}</td>
                        <td>{RESERVATION_STATUS_LABELS[effectiveStatus(reservation, overrides)]}</td>
                        <td>{formatTimeRange(reservation)}</td>
                        <td>{reservation.customerName}</td>
                        <td>{reservation.purpose}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {isEmpty && (
            <div className="notice">
              <p>条件に合致する予約はありません。</p>
              {hasFilter && (
                <button type="button" onClick={resetSearch}>
                  絞り込みを解除する
                </button>
              )}
            </div>
          )}

          {!isEmpty && (
            <nav className="pager" aria-label="ページ送り">
              <button
                type="button"
                disabled={isInitialLoading || targetPage <= 1}
                onClick={() => updateSearch({ ...search, page: targetPage - 1 })}
              >
                前へ
              </button>
              <span>
                ページ {displayedPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={isInitialLoading || result === null || targetPage >= totalPages}
                onClick={() => updateSearch({ ...search, page: targetPage + 1 })}
              >
                次へ
              </button>
            </nav>
          )}
        </>
      )}
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

import { useCallback, useEffect, useRef, useState } from 'react'
import { listReservations, type ReservationListResult } from '../../mock/api'
import { toListQuery, type ReservationSearch } from './searchQuery'

/**
 * 一覧の取得状態。
 * loading: 初回読込（表示できる結果がまだない）
 * refreshing: 条件変更などによる再取得（直前の結果を表示したまま）
 * ready: 現在の検索条件に対応する結果を表示している
 * error: 取得に失敗した
 */
export type ReservationListStatus = 'loading' | 'refreshing' | 'ready' | 'error'

export interface ReservationListState {
  status: ReservationListStatus
  /** 直近に取得できた結果。再取得中は直前の条件に対応する結果を保持する。 */
  result: ReservationListResult | null
  /** result を取得したときの検索条件。まだ結果がない場合は null。 */
  appliedSearch: ReservationSearch | null
  errorMessage: string
  /** 同一の検索条件で取得をやり直す。 */
  retry: () => void
}

export function useReservationList(search: ReservationSearch): ReservationListState {
  const [status, setStatus] = useState<ReservationListStatus>('loading')
  const [result, setResult] = useState<ReservationListResult | null>(null)
  const [appliedSearch, setAppliedSearch] = useState<ReservationSearch | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [attempt, setAttempt] = useState(0)

  // 応答の到着順は要求順と一致しないため、最新の要求のみを採用する。
  const latestRequestId = useRef(0)
  const hasResult = useRef(false)

  useEffect(() => {
    const requestId = latestRequestId.current + 1
    latestRequestId.current = requestId
    setStatus(hasResult.current ? 'refreshing' : 'loading')

    void listReservations(toListQuery(search)).then((listResult) => {
      // 古い応答が新しい応答を上書きしないようにする。
      if (requestId !== latestRequestId.current) return

      if (listResult.ok) {
        hasResult.current = true
        setResult(listResult.value)
        setAppliedSearch(search)
        setErrorMessage('')
        setStatus('ready')
      } else {
        setErrorMessage(listResult.error.message)
        setStatus('error')
      }
    })
  }, [search, attempt])

  const retry = useCallback(() => {
    setAttempt((current) => current + 1)
  }, [])

  return { status, result, appliedSearch, errorMessage, retry }
}

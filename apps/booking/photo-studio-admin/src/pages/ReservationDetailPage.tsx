import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  isIrreversible,
  nextStatuses,
  STATUS_ACTION_LABELS,
} from '../domain/statusTransitions'
import { formatTel } from '../domain/tel'
import {
  RESERVATION_STATUS_LABELS,
  type Reservation,
  type ReservationStatus,
  type Studio,
} from '../domain/types'
import { getReservation, listStudios, updateReservationStatus } from '../mock/api'
import { readListSearch } from '../features/reservations/searchQuery'
import {
  effectiveStatus,
  useStatusOverrides,
} from '../features/reservations/statusOverridesContext'

type LoadStatus = 'loading' | 'ready' | 'notFound' | 'error'

function formatTimeRange(reservation: Reservation): string {
  const end = reservation.startHour + reservation.hours
  return `${String(reservation.startHour).padStart(2, '0')}:00–${String(end).padStart(2, '0')}:00`
}

function formatDateTime(isoDateTime: string): string {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return isoDateTime
  return parsed.toISOString().replace('T', ' ').slice(0, 16)
}

export function ReservationDetailPage() {
  const { reservationId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const listSearch = useMemo(() => readListSearch(searchParams), [searchParams])

  const { overrides, apply, revert } = useStatusOverrides()

  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading')
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [studios, setStudios] = useState<Studio[]>([])
  const [loadErrorMessage, setLoadErrorMessage] = useState('')
  /** 更新中のステータス。同一の操作を重複して実行させないために用いる。 */
  const [pendingStatus, setPendingStatus] = useState<ReservationStatus | null>(null)
  const [updateErrorMessage, setUpdateErrorMessage] = useState('')
  /** 確認を求めている遷移先。 */
  const [confirmingStatus, setConfirmingStatus] = useState<ReservationStatus | null>(null)
  /** 更新の完了を支援技術へ伝えるための文言。 */
  const [updateNotice, setUpdateNotice] = useState('')

  const closeConfirm = useCallback(() => {
    setConfirmingStatus(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadStatus('loading')
    void getReservation(reservationId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setReservation(result.value)
        setLoadStatus('ready')
      } else if (result.error.code === 'NOT_FOUND') {
        setLoadStatus('notFound')
      } else {
        setLoadErrorMessage(result.error.message)
        setLoadStatus('error')
      }
    })
    return () => {
      cancelled = true
    }
  }, [reservationId])

  useEffect(() => {
    let cancelled = false
    void listStudios().then((result) => {
      if (!cancelled && result.ok) setStudios(result.value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const changeStatus = useCallback(
    async (next: ReservationStatus) => {
      if (reservation === null || pendingStatus !== null) return

      setConfirmingStatus(null)
      setUpdateErrorMessage('')
      setUpdateNotice('')
      setPendingStatus(next)
      // 応答を待たずに反映する。一覧にも同じ値が見える。
      apply(reservation.id, next)

      const result = await updateReservationStatus(reservation.id, next)
      setPendingStatus(null)

      if (result.ok) {
        setReservation(result.value)
        setUpdateNotice(`ステータスを${RESERVATION_STATUS_LABELS[next]}に変更しました。`)
      } else {
        // 直前の状態へ復元し、画面遷移を伴わずに通知する。
        revert(reservation.id)
        setUpdateErrorMessage(result.error.message)
      }
    },
    [reservation, pendingStatus, apply, revert],
  )

  const backLink = { pathname: '/', search: listSearch }

  if (loadStatus === 'loading') {
    return (
      <section className="detail">
        <p aria-live="polite">読み込み中</p>
      </section>
    )
  }

  if (loadStatus === 'notFound') {
    return (
      <section className="detail">
        <h1>予約が見つかりません</h1>
        <p>指定された予約は存在しません。URLをご確認ください。</p>
        <p>
          <Link to={backLink}>一覧へ戻る</Link>
        </p>
      </section>
    )
  }

  if (loadStatus === 'error' || reservation === null) {
    return (
      <section className="detail">
        <h1>予約詳細</h1>
        <p role="alert">{loadErrorMessage}</p>
        <p>
          <Link to={backLink}>一覧へ戻る</Link>
        </p>
      </section>
    )
  }

  const status = effectiveStatus(reservation, overrides)
  const studioName = studios.find((studio) => studio.id === reservation.studioId)?.name ?? reservation.studioId
  const actions = nextStatuses(status)

  return (
    <section className="detail">
      <p>
        <Link to={backLink}>← 一覧へ戻る</Link>
      </p>
      <h1>予約詳細</h1>

      <dl className="detail__items">
        <dt>予約ID</dt>
        <dd>{reservation.id}</dd>
        <dt>ステータス</dt>
        <dd>
          {RESERVATION_STATUS_LABELS[status]}
          {pendingStatus !== null && <span className="detail__pending"> 更新中…</span>}
        </dd>
        <dt>日付</dt>
        <dd>{reservation.date}</dd>
        <dt>時間帯</dt>
        <dd>{formatTimeRange(reservation)}</dd>
        <dt>スタジオ</dt>
        <dd>{studioName}</dd>
        <dt>顧客名</dt>
        <dd>{reservation.customerName}</dd>
        <dt>電話番号</dt>
        <dd>{formatTel(reservation.customerTel)}</dd>
        <dt>メールアドレス</dt>
        <dd>{reservation.customerEmail}</dd>
        <dt>利用目的</dt>
        <dd>{reservation.purpose}</dd>
        <dt>備考</dt>
        <dd>{reservation.note ?? 'なし'}</dd>
        <dt>受付日時</dt>
        <dd>{formatDateTime(reservation.createdAt)}</dd>
      </dl>

      <p className="detail__notice" role="status">
        {updateNotice}
      </p>

      {updateErrorMessage !== '' && (
        <p className="detail__error" role="alert">
          {updateErrorMessage}
        </p>
      )}

      <div className="detail__actions">
        {actions.length === 0 ? (
          <p className="detail__hint">このステータスから変更できる操作はありません。</p>
        ) : (
          actions.map((next) => (
            <button
              key={next}
              type="button"
              disabled={pendingStatus !== null}
              onClick={() => {
                if (isIrreversible(next)) {
                  setConfirmingStatus(next)
                } else {
                  void changeStatus(next)
                }
              }}
            >
              {STATUS_ACTION_LABELS[next]}
            </button>
          ))
        )}
      </div>

      {confirmingStatus !== null && (
        <ConfirmDialog
          title="操作の確認"
          description={`この予約を${RESERVATION_STATUS_LABELS[confirmingStatus]}にします。元に戻せません。よろしいですか？`}
          confirmLabel={`${RESERVATION_STATUS_LABELS[confirmingStatus]}にする`}
          busy={pendingStatus !== null}
          onConfirm={() => void changeStatus(confirmingStatus)}
          onCancel={closeConfirm}
        />
      )}
    </section>
  )
}

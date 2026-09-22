import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StatusBadge } from '../components/StatusBadge'
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

/** 取得の結末。読み込み中は結果が無い状態として表す。 */
type LoadResult =
  | { status: 'ready'; reservation: Reservation }
  | { status: 'notFound' }
  | { status: 'error'; message: string }

/** 予約に対する操作の状態。 */
interface OperationState {
  /** 更新中のステータス。同一の操作を重複して実行させないために用いる。 */
  pending: ReservationStatus | null
  /** 確認を求めている遷移先。 */
  confirming: ReservationStatus | null
  /** 更新の完了を支援技術へ伝えるための文言。 */
  notice: string
  /** 更新の失敗を伝える文言。 */
  errorMessage: string
}

const NO_OPERATION: OperationState = {
  pending: null,
  confirming: null,
  notice: '',
  errorMessage: '',
}

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

  /**
   * 取得の結果。どの予約に対する結果かを併せて持つ。
   *
   * 予約が変わった際に副作用から読み込み中へ戻すと描画が連鎖するため、
   * 状態を戻さず、要求中の予約と結果の予約が一致するかで読み込み中を導く。
   */
  const [loaded, setLoaded] = useState<{ id: string; result: LoadResult } | null>(null)
  const loadResult = loaded?.id === reservationId ? loaded.result : null
  /** 取得済みの予約。操作の可否を判断するため、早期復帰より前から参照する。 */
  const currentReservation = loadResult?.status === 'ready' ? loadResult.reservation : null

  const [studios, setStudios] = useState<Studio[]>([])

  /**
   * 操作の状態。取得の結果と同じく、どの予約に対するものかを併せて持つ。
   *
   * 応答を待つ間に別の予約へ移ると、要求時の予約に対する結果が後から届く。
   * 表示は現在の予約に対応するものだけから導き、前の予約の通知や更新中の
   * 表示が移った先へ混ざらないようにする。
   */
  const [operation, setOperation] = useState<{ id: string; state: OperationState }>({
    id: reservationId,
    state: NO_OPERATION,
  })
  const {
    pending: pendingStatus,
    confirming: confirmingStatus,
    notice: updateNotice,
    errorMessage: updateErrorMessage,
  } = operation.id === reservationId ? operation.state : NO_OPERATION

  /** 指定の予約に対する操作の状態を書き換える。 */
  const updateOperation = useCallback((id: string, change: Partial<OperationState>) => {
    setOperation((prev) => ({
      id,
      state: { ...(prev.id === id ? prev.state : NO_OPERATION), ...change },
    }))
  }, [])

  /** 確認の実行で操作ボタンが消える場合の、焦点の移動先。 */
  const noticeRef = useRef<HTMLParagraphElement | null>(null)

  const closeConfirm = useCallback(() => {
    updateOperation(reservationId, { confirming: null })
  }, [reservationId, updateOperation])

  useEffect(() => {
    let cancelled = false
    void getReservation(reservationId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setLoaded({ id: reservationId, result: { status: 'ready', reservation: result.value } })
      } else if (result.error.code === 'NOT_FOUND') {
        setLoaded({ id: reservationId, result: { status: 'notFound' } })
      } else {
        setLoaded({ id: reservationId, result: { status: 'error', message: result.error.message } })
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
      if (currentReservation === null || pendingStatus !== null) return
      const targetId = currentReservation.id

      updateOperation(targetId, { pending: next, confirming: null, notice: '', errorMessage: '' })
      // 応答を待たずに反映する。一覧にも同じ値が見える。
      apply(targetId, next)

      const result = await updateReservationStatus(targetId, next)

      if (!result.ok) {
        // 楽観的な反映は一覧にも及ぶため、画面を離れていても直前の状態へ戻す。
        revert(targetId)
      }

      // 応答は要求した予約に対する結果として反映する。別の予約へ移っていれば、
      // 表示は移った先の状態から導かれるため、この書き込みは現れない。
      updateOperation(
        targetId,
        result.ok
          ? { pending: null, notice: `ステータスを${RESERVATION_STATUS_LABELS[next]}に変更しました。` }
          : { pending: null, errorMessage: result.error.message },
      )

      if (result.ok) {
        // 取得の結果は画面で共有するため、要求した予約のままの場合にのみ書き換える。
        setLoaded((prev) =>
          prev?.id === targetId
            ? { id: targetId, result: { status: 'ready', reservation: result.value } }
            : prev,
        )
      }
    },
    [currentReservation, pendingStatus, apply, revert, updateOperation],
  )

  const backLink = { pathname: '/', search: listSearch }

  if (loadResult === null) {
    return (
      <section className="detail">
        <p aria-live="polite">読み込み中</p>
      </section>
    )
  }

  if (loadResult.status === 'notFound') {
    return (
      <section className="detail">
        <div className="page-head">
          <h1 className="page-head__title">予約が見つかりません</h1>
        </div>
        <p>指定された予約は存在しません。URLをご確認ください。</p>
        <p>
          <Link to={backLink}>一覧へ戻る</Link>
        </p>
      </section>
    )
  }

  if (loadResult.status === 'error') {
    return (
      <section className="detail">
        <div className="page-head">
          <h1 className="page-head__title">予約詳細</h1>
        </div>
        <p className="detail__error" role="alert">
          {loadResult.message}
        </p>
        <p>
          <Link to={backLink}>一覧へ戻る</Link>
        </p>
      </section>
    )
  }

  const reservation = loadResult.reservation
  const status = effectiveStatus(reservation, overrides)
  const studioName =
    studios.find((studio) => studio.id === reservation.studioId)?.name ?? reservation.studioId
  const actions = nextStatuses(status)

  return (
    <section className="detail">
      <p className="back-link">
        <Link to={backLink}>← 一覧へ戻る</Link>
      </p>

      {/* 画面名と操作を上部へ置き、内容を読む前に取れる操作が分かるようにする。 */}
      <div className="page-head">
        <h1 className="page-head__title">予約詳細</h1>
        <div className="page-head__actions">
          {actions.length === 0 ? (
            <p className="detail__hint">このステータスから変更できる操作はありません。</p>
          ) : (
            actions.map((next) => (
              <button
                key={next}
                type="button"
                // 取り消せない操作は警告色で区別する。
                className={`button ${isIrreversible(next) ? 'button--danger' : 'button--primary'}`}
                disabled={pendingStatus !== null}
                onClick={() => {
                  if (isIrreversible(next)) {
                    updateOperation(reservationId, { confirming: next })
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
      </div>

      {/* 顧客名と日時を見出し相当へ上げ、最初に目に入るようにする。 */}
      <div className="detail__summary panel">
        <h2 className="detail__customer">{reservation.customerName}</h2>
        <p className="detail__when">
          {reservation.date} {formatTimeRange(reservation)}
        </p>
        <p className="detail__studio">{studioName}</p>
        <StatusBadge status={status} />
      </div>

      <p className="detail__notice" role="status" tabIndex={-1} ref={noticeRef}>
        {updateNotice}
      </p>

      {updateErrorMessage !== '' && (
        <p className="detail__error" role="alert">
          {updateErrorMessage}
        </p>
      )}

      <div className="detail__columns">
        <section className="panel">
          <h3 className="detail__section-title">予約情報</h3>
          <dl className="detail__items">
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
            <dt>利用目的</dt>
            <dd>{reservation.purpose}</dd>
            <dt>備考</dt>
            <dd>{reservation.note ?? 'なし'}</dd>
          </dl>
        </section>

        <section className="panel">
          <h3 className="detail__section-title">顧客情報</h3>
          <dl className="detail__items">
            <dt>顧客名</dt>
            <dd>{reservation.customerName}</dd>
            <dt>電話番号</dt>
            <dd>{formatTel(reservation.customerTel)}</dd>
            <dt>メールアドレス</dt>
            <dd>{reservation.customerEmail}</dd>
          </dl>

          {/* 受付日時と予約IDは参照のための補助情報として下げる。 */}
          <dl className="detail__items detail__id">
            <dt>受付日時</dt>
            <dd>{formatDateTime(reservation.createdAt)}</dd>
            <dt>予約ID</dt>
            <dd>{reservation.id}</dd>
          </dl>
        </section>
      </div>

      {confirmingStatus !== null && (
        <ConfirmDialog
          title="操作の確認"
          description={`この予約を${RESERVATION_STATUS_LABELS[confirmingStatus]}にします。元に戻せません。よろしいですか？`}
          confirmLabel={`${RESERVATION_STATUS_LABELS[confirmingStatus]}にする`}
          busy={pendingStatus !== null}
          fallbackFocusRef={noticeRef}
          onConfirm={() => void changeStatus(confirmingStatus)}
          onCancel={closeConfirm}
        />
      )}
    </section>
  )
}

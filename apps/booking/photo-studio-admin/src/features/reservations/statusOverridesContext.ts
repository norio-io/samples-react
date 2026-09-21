import { createContext, useContext } from 'react'
import type { Reservation, ReservationStatus } from '../../domain/types'

/**
 * ステータスの楽観的更新を画面間で共有する。
 *
 * 詳細画面での操作は応答を待たずに反映するため、同じ予約を表示している
 * 一覧にも同一の値が見える必要がある。失敗した場合はここから取り除くこと
 * で、詳細・一覧の双方が直前の状態へ戻る。
 */
export interface StatusOverridesValue {
  overrides: Readonly<Record<string, ReservationStatus>>
  /** 楽観的に反映する。 */
  apply: (id: string, status: ReservationStatus) => void
  /** 失敗した場合に取り消す。 */
  revert: (id: string) => void
}

export const StatusOverridesContext = createContext<StatusOverridesValue | null>(null)

export function useStatusOverrides(): StatusOverridesValue {
  const value = useContext(StatusOverridesContext)
  if (value === null) {
    throw new Error('ReservationStatusOverridesProvider の内側で使用してください')
  }
  return value
}

/** 楽観的更新を加味したステータスを返す。 */
export function effectiveStatus(
  reservation: Reservation,
  overrides: Readonly<Record<string, ReservationStatus>>,
): ReservationStatus {
  return overrides[reservation.id] ?? reservation.status
}

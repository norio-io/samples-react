import type { ReservationStatus } from './types'

/**
 * 予約ステータスの遷移規則。画面のボタン表示と更新処理の双方がこの定義を
 * 参照する。完了およびキャンセルは終端であり、遷移先を持たない。
 */
export const STATUS_TRANSITIONS: Record<ReservationStatus, readonly ReservationStatus[]> = {
  tentative: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

/** 遷移先として提示する操作の名称。 */
export const STATUS_ACTION_LABELS: Record<ReservationStatus, string> = {
  tentative: '仮予約に戻す',
  confirmed: '確定する',
  completed: '完了にする',
  cancelled: 'キャンセルする',
}

/** 復旧できない遷移。実行前に確認を求める。 */
export const IRREVERSIBLE_STATUSES: readonly ReservationStatus[] = ['cancelled']

export function nextStatuses(from: ReservationStatus): readonly ReservationStatus[] {
  return STATUS_TRANSITIONS[from]
}

export function canTransition(from: ReservationStatus, to: ReservationStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to)
}

export function isIrreversible(to: ReservationStatus): boolean {
  return IRREVERSIBLE_STATUSES.includes(to)
}

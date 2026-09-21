/** 撮影スタジオ（室） */
export interface Studio {
  id: string
  name: string
  /** 時間単価（円） */
  hourlyRate: number
}

/**
 * 予約ステータス。
 * tentative: 仮予約 / confirmed: 確定 / completed: 完了 / cancelled: キャンセル
 */
export type ReservationStatus = 'tentative' | 'confirmed' | 'completed' | 'cancelled'

export const RESERVATION_STATUSES = [
  'tentative',
  'confirmed',
  'completed',
  'cancelled',
] as const satisfies readonly ReservationStatus[]

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  tentative: '仮予約',
  confirmed: '確定',
  completed: '完了',
  cancelled: 'キャンセル',
}

/** 予約 */
export interface Reservation {
  id: string
  studioId: string
  /** YYYY-MM-DD */
  date: string
  /** 開始時刻（24時間表記の時） */
  startHour: number
  /** 利用時間数 */
  hours: number
  customerName: string
  customerTel: string
  customerEmail: string
  /** 利用目的（家族写真、商品撮影など） */
  purpose: string
  status: ReservationStatus
  /** 備考（任意） */
  note?: string
  /** ISO 8601 */
  createdAt: string
}

/** 登録時に受け取る値。id と createdAt はモックAPI側で採番する。 */
export type ReservationDraft = Omit<Reservation, 'id' | 'createdAt'>

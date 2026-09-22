import { RESERVATION_STATUS_LABELS, type ReservationStatus } from '../domain/types'

/**
 * ステータスのバッジ。
 *
 * 一覧を走査した際に状態の分布が掴めるよう色を与えるが、色のみに依存させない。
 * 文字は常に表示し、バッジの内容はステータスの表示名のみとする。
 */
export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <span className={`badge badge--${status}`}>{RESERVATION_STATUS_LABELS[status]}</span>
}

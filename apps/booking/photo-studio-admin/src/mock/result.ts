/**
 * モックAPIの結果表現。
 * 失敗は例外ではなく値として返し、呼び出し側で判定可能とする。
 */
export type ApiErrorCode =
  | 'NOT_FOUND'
  /** 同一スタジオ・同一時間帯の予約が既に存在する */
  | 'DUPLICATED'
  /** 通信障害を模した一時的な失敗 */
  | 'TEMPORARY_FAILURE'

export interface ApiError {
  code: ApiErrorCode
  message: string
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ApiError }

export function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function fail<T>(code: ApiErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } }
}

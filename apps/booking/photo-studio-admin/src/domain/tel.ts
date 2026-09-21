/**
 * 電話番号は半角数字のみを保存値とし、表示時に整形する。
 * 入力・初期データ・検索の各所で表記が混ざらないようにするため。
 */

/** 入力値から数字以外を取り除く。 */
export function normalizeTel(value: string): string {
  return value.replace(/\D/g, '')
}

/** 保存値を表示用へ整形する。桁数が想定外の場合はそのまま返す。 */
export function formatTel(tel: string): string {
  if (/^\d{11}$/.test(tel)) {
    return `${tel.slice(0, 3)}-${tel.slice(3, 7)}-${tel.slice(7)}`
  }
  if (/^\d{10}$/.test(tel)) {
    return `${tel.slice(0, 2)}-${tel.slice(2, 6)}-${tel.slice(6)}`
  }
  return tel
}

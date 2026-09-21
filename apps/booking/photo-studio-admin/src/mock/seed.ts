import { addDays } from '../domain/date'
import type { Reservation, ReservationStatus, Studio } from '../domain/types'

/**
 * 初期データは乱数を用いず、添字に対する決定的な手順のみで生成する。
 * 再読み込みやテスト実行の時点によらず、常に同一の内容となる。
 */

export const STUDIOS: readonly Studio[] = [
  { id: 'studio-a', name: 'Aスタジオ', hourlyRate: 6000 },
  { id: 'studio-b', name: 'Bスタジオ', hourlyRate: 8000 },
  { id: 'studio-h', name: 'ホリゾンタル', hourlyRate: 12000 },
]

/** 初期データの基準日。実行日に依存させないため固定値とする。 */
export const SEED_ANCHOR_DATE = '2026-09-21'

/** 初期データの件数。基準日の前後およそ1か月に分布させる。 */
export const SEED_RESERVATION_COUNT = 80

/** 基準日からの日数の振れ幅（-30 〜 +30）。 */
const DAY_SPAN = 61
const DAY_OFFSET_START = -30

// 架空の氏名・目的。実在する個人情報は含めない。
const FAMILY_NAMES = [
  '相川',
  '井口',
  '宇野',
  '江川',
  '小野寺',
  '柏木',
  '如月',
  '久住',
  '毛利',
  '古賀',
  '早乙女',
  '志野',
  '菅生',
  '瀬能',
  '十和田',
  '苗場',
  '新関',
  '布施',
  '真鍋',
  '八乙女',
] as const

const GIVEN_NAMES = ['陽向', '結衣', '奏太', '澪', '悠真', '芽依', '湊斗', '千尋'] as const

const PURPOSES = [
  '家族写真',
  '商品撮影',
  'プロフィール写真',
  '七五三',
  '成人式前撮り',
  'ECカタログ撮影',
  '宣材写真',
  '会社案内用撮影',
] as const

const NOTES = [
  '',
  '大型機材の搬入あり',
  '当日は代理の方が来店予定',
  'レフ板の追加貸出を希望',
  '',
  '撮影データの当日受け渡しを希望',
] as const

function pick<T>(table: readonly T[], index: number): T {
  const value = table[index % table.length]
  if (value === undefined) {
    throw new Error('初期データの生成に失敗しました')
  }
  return value
}

function statusOf(dayOffset: number, index: number): ReservationStatus {
  if (dayOffset < 0) {
    // 過去日は完了を基本とし、一部をキャンセルとする。
    return index % 5 === 0 ? 'cancelled' : 'completed'
  }
  if (index % 4 === 0) return 'tentative'
  if (index % 7 === 0) return 'cancelled'
  return 'confirmed'
}

function createdAtOf(date: string, index: number): string {
  // 予約日の 3〜12 日前、9時台の固定時刻に受け付けたものとする。
  const created = addDays(date, -(3 + (index % 10)))
  const minutes = (index * 7) % 60
  return `${created}T09:${String(minutes).padStart(2, '0')}:00.000Z`
}

export function createSeedReservations(): Reservation[] {
  return Array.from({ length: SEED_RESERVATION_COUNT }, (_, index) => {
    // 17 と 61 は互いに素であり、添字は基準日前後へ偏りなく分布する。
    const dayOffset = DAY_OFFSET_START + ((index * 17) % DAY_SPAN)
    const date = addDays(SEED_ANCHOR_DATE, dayOffset)
    const studio = pick(STUDIOS, index)
    const note = pick(NOTES, index)
    const reservation: Reservation = {
      id: `rsv-${String(index + 1).padStart(3, '0')}`,
      studioId: studio.id,
      date,
      startHour: 9 + ((index * 5) % 9),
      hours: 1 + (index % 4),
      customerName: `${pick(FAMILY_NAMES, index)} ${pick(GIVEN_NAMES, index + Math.floor(index / FAMILY_NAMES.length))}`,
      // 電話番号は数字のみを保存値とする。表示時に formatTel で整形する。
      customerTel: `0900000${String(1000 + index).padStart(4, '0')}`,
      customerEmail: `guest${String(index + 1).padStart(3, '0')}@example.com`,
      purpose: pick(PURPOSES, index),
      status: statusOf(dayOffset, index),
      createdAt: createdAtOf(date, index),
    }
    return note === '' ? reservation : { ...reservation, note }
  })
}

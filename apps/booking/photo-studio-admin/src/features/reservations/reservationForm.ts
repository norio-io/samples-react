import {
  CLOSING_HOUR,
  fitsInBusinessHours,
  formatHour,
  isValidStartHour,
  OPENING_HOUR,
} from '../../domain/businessHours'
import type { ReservationDraft } from '../../domain/types'
import { STUDIOS } from '../../mock/seed'

/** 登録フォームの入力値。すべて文字列として保持する。 */
export interface ReservationFormValues {
  date: string
  studioId: string
  startHour: string
  hours: string
  customerName: string
  customerTel: string
  customerEmail: string
  purpose: string
  note: string
}

export const EMPTY_FORM_VALUES: ReservationFormValues = {
  date: '',
  studioId: '',
  startHour: '',
  hours: '1',
  customerName: '',
  customerTel: '',
  customerEmail: '',
  purpose: '',
  note: '',
}

/** 検証対象の項目。焦点を移す順序でもある。 */
export const FORM_FIELDS = [
  'date',
  'studioId',
  'startHour',
  'hours',
  'customerName',
  'customerTel',
  'customerEmail',
  'purpose',
] as const

export type ReservationFormField = (typeof FORM_FIELDS)[number]

export const FORM_FIELD_LABELS: Record<ReservationFormField | 'note', string> = {
  date: '日付',
  studioId: 'スタジオ',
  startHour: '開始時刻',
  hours: '利用時間数',
  customerName: '顧客名',
  customerTel: '電話番号',
  customerEmail: 'メールアドレス',
  purpose: '用途',
  note: '備考',
}

export type ReservationFormErrors = Partial<Record<ReservationFormField, string>>

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
/** 電話番号はハイフンなしの半角数字とする。 */
const TEL_PATTERN = /^\d{10,11}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isBlank(value: string): boolean {
  return value.trim() === ''
}

/**
 * 入力値を検証する。今日より前の日付は受け付けない。
 * 判定の基準日は呼び出し側から与える。
 */
export function validateReservationForm(
  values: ReservationFormValues,
  options: { today: string },
): ReservationFormErrors {
  const errors: ReservationFormErrors = {}

  if (isBlank(values.date)) {
    errors.date = '日付を入力してください。'
  } else if (!DATE_PATTERN.test(values.date)) {
    errors.date = '日付の形式が正しくありません。'
  } else if (values.date < options.today) {
    errors.date = '過去の日付は指定できません。'
  }

  if (isBlank(values.studioId)) {
    errors.studioId = 'スタジオを選択してください。'
  } else if (!STUDIOS.some((studio) => studio.id === values.studioId)) {
    errors.studioId = '選択できないスタジオです。'
  }

  const startHour = Number(values.startHour)
  if (isBlank(values.startHour)) {
    errors.startHour = '開始時刻を選択してください。'
  } else if (!isValidStartHour(startHour)) {
    errors.startHour = `開始時刻は${formatHour(OPENING_HOUR)}から${formatHour(CLOSING_HOUR - 1)}の間で指定してください。`
  }

  const hours = Number(values.hours)
  if (isBlank(values.hours)) {
    errors.hours = '利用時間数を入力してください。'
  } else if (!Number.isInteger(hours) || hours < 1) {
    errors.hours = '利用時間数は1以上の整数で指定してください。'
  } else if (errors.startHour === undefined && !fitsInBusinessHours(startHour, hours)) {
    errors.hours = `終了時刻が営業時間（${formatHour(CLOSING_HOUR)}）を超えています。`
  }

  if (isBlank(values.customerName)) errors.customerName = '顧客名を入力してください。'

  if (isBlank(values.customerTel)) {
    errors.customerTel = '電話番号を入力してください。'
  } else if (!TEL_PATTERN.test(values.customerTel)) {
    errors.customerTel = '電話番号はハイフンなしの半角数字で入力してください。'
  }

  if (isBlank(values.customerEmail)) {
    errors.customerEmail = 'メールアドレスを入力してください。'
  } else if (!EMAIL_PATTERN.test(values.customerEmail)) {
    errors.customerEmail = 'メールアドレスの形式が正しくありません。'
  }

  if (isBlank(values.purpose)) errors.purpose = '用途を入力してください。'

  return errors
}

/** 検証を通過した入力値を、登録用の値へ変換する。登録直後は仮予約とする。 */
export function toReservationDraft(values: ReservationFormValues): ReservationDraft {
  const draft: ReservationDraft = {
    studioId: values.studioId,
    date: values.date,
    startHour: Number(values.startHour),
    hours: Number(values.hours),
    customerName: values.customerName.trim(),
    customerTel: values.customerTel.trim(),
    customerEmail: values.customerEmail.trim(),
    purpose: values.purpose.trim(),
    status: 'tentative',
  }
  const note = values.note.trim()
  return note === '' ? draft : { ...draft, note }
}

/** 最初に誤りのある項目を返す。 */
export function firstInvalidField(errors: ReservationFormErrors): ReservationFormField | null {
  return FORM_FIELDS.find((field) => errors[field] !== undefined) ?? null
}

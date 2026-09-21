import { describe, expect, it } from 'vitest'
import {
  EMPTY_FORM_VALUES,
  firstInvalidField,
  toReservationDraft,
  validateReservationForm,
  type ReservationFormValues,
} from './reservationForm'

const TODAY = '2026-09-21'

const VALID: ReservationFormValues = {
  date: '2026-09-22',
  studioId: 'studio-a',
  startHour: '10',
  hours: '2',
  customerName: '検証 太郎',
  customerTel: '09000001234',
  customerEmail: 'test@example.com',
  purpose: '商品撮影',
  note: '',
}

function validate(overrides: Partial<ReservationFormValues> = {}) {
  return validateReservationForm({ ...VALID, ...overrides }, { today: TODAY })
}

describe('validateReservationForm', () => {
  it('妥当な入力では誤りを返さない', () => {
    expect(validate()).toEqual({})
  })

  it('未入力の必須項目をすべて指摘する', () => {
    const errors = validateReservationForm(EMPTY_FORM_VALUES, { today: TODAY })
    expect(Object.keys(errors).sort()).toEqual(
      ['customerEmail', 'customerName', 'customerTel', 'date', 'purpose', 'startHour', 'studioId'].sort(),
    )
    // 備考は任意。
    expect(errors).not.toHaveProperty('note')
  })

  it('過去の日付を拒否し、当日は受け付ける', () => {
    expect(validate({ date: '2026-09-20' }).date).toBe('過去の日付は指定できません。')
    expect(validate({ date: TODAY }).date).toBeUndefined()
    expect(validate({ date: '2026-9-22' }).date).toBe('日付の形式が正しくありません。')
  })

  it('未知のスタジオを拒否する', () => {
    expect(validate({ studioId: 'studio-x' }).studioId).toBe('選択できないスタジオです。')
  })

  it('営業時間の境界を判定する', () => {
    expect(validate({ startHour: '9', hours: '1' }).startHour).toBeUndefined()
    expect(validate({ startHour: '8' }).startHour).toContain('09:00')
    expect(validate({ startHour: '21' }).startHour).toContain('09:00')
    expect(validate({ startHour: '20', hours: '1' }).hours).toBeUndefined()
    expect(validate({ startHour: '20', hours: '2' }).hours).toContain('21:00')
    expect(validate({ startHour: '9', hours: '12' }).hours).toBeUndefined()
    expect(validate({ startHour: '9', hours: '13' }).hours).toContain('21:00')
  })

  it('利用時間数は1以上の整数とする', () => {
    expect(validate({ hours: '0' }).hours).toContain('1以上')
    expect(validate({ hours: '-1' }).hours).toContain('1以上')
    expect(validate({ hours: '1.5' }).hours).toContain('1以上')
  })

  it('開始時刻が不正な場合は利用時間数の超過を重ねて指摘しない', () => {
    const errors = validate({ startHour: '25', hours: '2' })
    expect(errors.startHour).toBeDefined()
    expect(errors.hours).toBeUndefined()
  })

  it('電話番号はハイフンなしの半角数字とする', () => {
    expect(validate({ customerTel: '090-0000-1234' }).customerTel).toContain('ハイフンなし')
    expect(validate({ customerTel: '０９０００００１２３４' }).customerTel).toContain('ハイフンなし')
    expect(validate({ customerTel: '123' }).customerTel).toContain('ハイフンなし')
    expect(validate({ customerTel: '0312345678' }).customerTel).toBeUndefined()
  })

  it('メールアドレスの形式を検査する', () => {
    expect(validate({ customerEmail: 'test' }).customerEmail).toContain('形式')
    expect(validate({ customerEmail: 'test@example' }).customerEmail).toContain('形式')
    expect(validate({ customerEmail: 'test@example.com' }).customerEmail).toBeUndefined()
  })

  it('空白のみの入力は未入力として扱う', () => {
    expect(validate({ customerName: '   ' }).customerName).toBe('顧客名を入力してください。')
  })
})

describe('firstInvalidField', () => {
  it('項目の順序に従って最初の誤りを返す', () => {
    expect(firstInvalidField(validateReservationForm(EMPTY_FORM_VALUES, { today: TODAY }))).toBe(
      'date',
    )
    expect(firstInvalidField(validate({ customerTel: '', purpose: '' }))).toBe('customerTel')
    expect(firstInvalidField({})).toBeNull()
  })
})

describe('toReservationDraft', () => {
  it('登録用の値へ変換し、ステータスは仮予約とする', () => {
    expect(toReservationDraft(VALID)).toEqual({
      studioId: 'studio-a',
      date: '2026-09-22',
      startHour: 10,
      hours: 2,
      customerName: '検証 太郎',
      customerTel: '09000001234',
      customerEmail: 'test@example.com',
      purpose: '商品撮影',
      status: 'tentative',
    })
  })

  it('備考は入力がある場合のみ含める', () => {
    expect(toReservationDraft({ ...VALID, note: ' 機材搬入あり ' })).toMatchObject({
      note: '機材搬入あり',
    })
    expect(toReservationDraft({ ...VALID, note: '   ' })).not.toHaveProperty('note')
  })
})

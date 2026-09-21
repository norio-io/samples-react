import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatHour, SELECTABLE_START_HOURS } from '../domain/businessHours'
import { formatDate } from '../domain/date'
import { RESERVATION_STATUS_LABELS, type Reservation, type Studio } from '../domain/types'
import { createReservation, listStudios } from '../mock/api'
import {
  EMPTY_FORM_VALUES,
  firstInvalidField,
  FORM_FIELD_LABELS,
  toReservationDraft,
  validateReservationForm,
  type ReservationFormErrors,
  type ReservationFormField,
  type ReservationFormValues,
} from '../features/reservations/reservationForm'

type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

/**
 * ラベル・入力・エラー文言を兄弟として並べる。
 * ラベルで入力を包むと、エラー文言がアクセシブル名に含まれてしまうため。
 */
function Field({
  field,
  error,
  children,
}: {
  field: ReservationFormField | 'note'
  error?: string | undefined
  children: ReactNode
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={field}>
        {FORM_FIELD_LABELS[field]}
      </label>
      {children}
      {error !== undefined && (
        <span className="field__error" id={`${field}-error`}>
          {error}
        </span>
      )}
    </div>
  )
}

export function ReservationCreatePage() {
  const navigate = useNavigate()
  const today = useMemo(() => formatDate(new Date()), [])

  const [values, setValues] = useState<ReservationFormValues>(EMPTY_FORM_VALUES)
  const [errors, setErrors] = useState<ReservationFormErrors>({})
  const [studios, setStudios] = useState<Studio[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitErrorMessage, setSubmitErrorMessage] = useState('')
  const [conflicts, setConflicts] = useState<readonly Reservation[]>([])

  const fieldRefs = useRef<Partial<Record<ReservationFormField, FieldElement | null>>>({})

  useEffect(() => {
    let cancelled = false
    void listStudios().then((result) => {
      if (!cancelled && result.ok) setStudios(result.value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /** 入力を再開した項目のエラー表示は解除する。 */
  const change = useCallback((field: keyof ReservationFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field as ReservationFormField]
      return next
    })
  }, [])

  const submit = async () => {
    if (submitting) return

    setSubmitErrorMessage('')
    setConflicts([])

    const found = validateReservationForm(values, { today })
    setErrors(found)

    const invalid = firstInvalidField(found)
    if (invalid !== null) {
      // 最初の誤りへ焦点を移す。
      fieldRefs.current[invalid]?.focus()
      return
    }

    setSubmitting(true)
    const result = await createReservation(toReservationDraft(values))
    setSubmitting(false)

    if (result.ok) {
      // 登録した予約を確認できるよう、当日の一覧へ遷移する。
      navigate({ pathname: '/', search: `?from=${result.value.date}&to=${result.value.date}` })
      return
    }

    setSubmitErrorMessage(result.error.message)
    setConflicts(result.error.conflicts ?? [])
  }

  const fieldProps = (field: ReservationFormField) => ({
    id: field,
    'aria-invalid': errors[field] !== undefined,
    'aria-describedby': errors[field] !== undefined ? `${field}-error` : undefined,
  })

  const studioName = (studioId: string) =>
    studios.find((studio) => studio.id === studioId)?.name ?? studioId

  return (
    <section className="create">
      <p>
        <Link to="/">← 一覧へ戻る</Link>
      </p>
      <h1>予約の登録</h1>
      <p className="create__hint">
        電話などで受け付けた予約を登録します。登録直後のステータスは
        {RESERVATION_STATUS_LABELS.tentative}です。
      </p>

      <form
        className="create__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Field field="date" error={errors.date}>
          <input
            {...fieldProps('date')}
            ref={(element) => {
              fieldRefs.current.date = element
            }}
            type="date"
            value={values.date}
            min={today}
            onChange={(event) => change('date', event.target.value)}
          />
        </Field>

        <Field field="studioId" error={errors.studioId}>
          <select
            {...fieldProps('studioId')}
            ref={(element) => {
              fieldRefs.current.studioId = element
            }}
            value={values.studioId}
            onChange={(event) => change('studioId', event.target.value)}
          >
            <option value="">選択してください</option>
            {studios.map((studio) => (
              <option key={studio.id} value={studio.id}>
                {studio.name}
              </option>
            ))}
          </select>
        </Field>

        <Field field="startHour" error={errors.startHour}>
          <select
            {...fieldProps('startHour')}
            ref={(element) => {
              fieldRefs.current.startHour = element
            }}
            value={values.startHour}
            onChange={(event) => change('startHour', event.target.value)}
          >
            <option value="">選択してください</option>
            {SELECTABLE_START_HOURS.map((hour) => (
              <option key={hour} value={String(hour)}>
                {formatHour(hour)}
              </option>
            ))}
          </select>
        </Field>

        <Field field="hours" error={errors.hours}>
          <input
            {...fieldProps('hours')}
            ref={(element) => {
              fieldRefs.current.hours = element
            }}
            type="number"
            min="1"
            value={values.hours}
            onChange={(event) => change('hours', event.target.value)}
          />
        </Field>

        <Field field="customerName" error={errors.customerName}>
          <input
            {...fieldProps('customerName')}
            ref={(element) => {
              fieldRefs.current.customerName = element
            }}
            type="text"
            value={values.customerName}
            onChange={(event) => change('customerName', event.target.value)}
          />
        </Field>

        <Field field="customerTel" error={errors.customerTel}>
          <input
            {...fieldProps('customerTel')}
            ref={(element) => {
              fieldRefs.current.customerTel = element
            }}
            type="tel"
            inputMode="numeric"
            placeholder="09000001234"
            value={values.customerTel}
            onChange={(event) => change('customerTel', event.target.value)}
          />
        </Field>

        <Field field="customerEmail" error={errors.customerEmail}>
          <input
            {...fieldProps('customerEmail')}
            ref={(element) => {
              fieldRefs.current.customerEmail = element
            }}
            type="email"
            value={values.customerEmail}
            onChange={(event) => change('customerEmail', event.target.value)}
          />
        </Field>

        <Field field="purpose" error={errors.purpose}>
          <input
            {...fieldProps('purpose')}
            ref={(element) => {
              fieldRefs.current.purpose = element
            }}
            type="text"
            value={values.purpose}
            onChange={(event) => change('purpose', event.target.value)}
          />
        </Field>

        <Field field="note">
          <textarea
            id="note"
            rows={3}
            value={values.note}
            onChange={(event) => change('note', event.target.value)}
          />
        </Field>

        {submitErrorMessage !== '' && (
          <div className="notice">
            <p role="alert">{submitErrorMessage}</p>
            {conflicts.length > 0 && (
              <>
                <p className="notice__hint">重なっている既存の予約は次のとおりです。</p>
                <ul>
                  {conflicts.map((conflict) => (
                    <li key={conflict.id}>
                      {conflict.date} {formatHour(conflict.startHour)}–
                      {formatHour(conflict.startHour + conflict.hours)} {studioName(conflict.studioId)}{' '}
                      {conflict.customerName}（{RESERVATION_STATUS_LABELS[conflict.status]}）
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="create__actions">
          <button type="submit" disabled={submitting}>
            {submitting ? '登録中…' : '登録する'}
          </button>
        </div>
      </form>
    </section>
  )
}

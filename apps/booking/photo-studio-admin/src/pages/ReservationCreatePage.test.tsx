import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppRoutes } from '../app/AppRoutes'
import { addDays, getToday } from '../domain/date'
import { createReservation, listReservations, resetMockStore } from '../mock/api'
import { resetMutationFailureRate, setMutationFailureRate } from '../mock/config'
import type { ReservationDraft } from '../domain/types'

/** 初期データの範囲外の日付を用い、既存の予約と干渉しないようにする。 */
const TARGET_DATE = addDays(getToday(), 60)

function renderCreatePage() {
  return render(
    <MemoryRouter initialEntries={['/reservations/new']}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

async function fillValidValues(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^日付/), TARGET_DATE)
  // スタジオの選択肢は非同期に読み込まれる。
  await screen.findByRole('option', { name: 'Aスタジオ' })
  await user.selectOptions(screen.getByLabelText(/^スタジオ/), 'studio-a')
  await user.selectOptions(screen.getByLabelText(/^開始時刻/), '10')
  await user.clear(screen.getByLabelText(/^利用時間数/))
  await user.type(screen.getByLabelText(/^利用時間数/), '2')
  await user.type(screen.getByLabelText(/^顧客名/), '検証 太郎')
  await user.type(screen.getByLabelText(/^電話番号/), '09000001234')
  await user.type(screen.getByLabelText(/^メールアドレス/), 'test@example.com')
  await user.type(screen.getByLabelText(/^用途/), '商品撮影')
}

const CONFLICTING: ReservationDraft = {
  studioId: 'studio-a',
  date: TARGET_DATE,
  startHour: 11,
  hours: 2,
  customerName: '先約 花子',
  customerTel: '09000009999',
  customerEmail: 'existing@example.com',
  purpose: '家族写真',
  status: 'confirmed',
}

beforeEach(() => {
  resetMockStore()
  setMutationFailureRate(0)
})

afterEach(() => {
  resetMutationFailureRate()
})

describe('ReservationCreatePage', () => {
  it('必須項目が未入力の場合は指摘し、最初の誤りへ焦点を移す', async () => {
    const user = userEvent.setup()
    renderCreatePage()

    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(screen.getByText('日付を入力してください。')).toBeInTheDocument()
    expect(screen.getByText('スタジオを選択してください。')).toBeInTheDocument()
    expect(screen.getByText('顧客名を入力してください。')).toBeInTheDocument()
    expect(screen.getByText('用途を入力してください。')).toBeInTheDocument()

    const dateField = screen.getByLabelText(/^日付/)
    expect(dateField).toHaveFocus()
    expect(dateField).toHaveAttribute('aria-invalid', 'true')
    // エラー文言は入力欄と関連づける。
    expect(dateField).toHaveAccessibleDescription('日付を入力してください。')
  })

  it('入力を再開した項目のエラー表示は解除される', async () => {
    const user = userEvent.setup()
    renderCreatePage()

    await user.click(screen.getByRole('button', { name: '登録する' }))
    expect(screen.getByText('顧客名を入力してください。')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^顧客名/), '検')

    expect(screen.queryByText('顧客名を入力してください。')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^顧客名/)).toHaveAttribute('aria-invalid', 'false')
    // 他の項目の指摘は残る。
    expect(screen.getByText('用途を入力してください。')).toBeInTheDocument()
  })

  it('過去の日付と営業時間外を拒否する', async () => {
    const user = userEvent.setup()
    renderCreatePage()

    await user.type(screen.getByLabelText(/^日付/), addDays(getToday(), -1))
    await user.selectOptions(screen.getByLabelText(/^開始時刻/), '20')
    await user.clear(screen.getByLabelText(/^利用時間数/))
    await user.type(screen.getByLabelText(/^利用時間数/), '2')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(screen.getByText('過去の日付は指定できません。')).toBeInTheDocument()
    expect(screen.getByText('終了時刻が営業時間（21:00）を超えています。')).toBeInTheDocument()
  })

  it('時間帯が重なる場合は登録を拒否し、重なっている既存の予約を示す', async () => {
    const user = userEvent.setup()
    const existing = await createReservation(CONFLICTING)
    expect(existing.ok).toBe(true)

    renderCreatePage()
    await fillValidValues(user)
    // 10:00-12:00 は既存の 11:00-13:00 と重なる。
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('指定の日時は既に予約されています。')
    const conflict = screen.getByRole('listitem')
    expect(conflict).toHaveTextContent('先約 花子')
    expect(conflict).toHaveTextContent('11:00–13:00')
    expect(conflict).toHaveTextContent('Aスタジオ')
    expect(conflict).toHaveTextContent('確定')
    // 画面遷移は行わない。
    expect(screen.getByRole('heading', { name: '予約の登録' })).toBeInTheDocument()
  })

  it('登録に成功すると一覧へ遷移し、登録した予約を確認できる', async () => {
    const user = userEvent.setup()
    renderCreatePage()

    await fillValidValues(user)
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByRole('heading', { name: '予約一覧' })).toBeInTheDocument()
    expect(await screen.findByText('検証 太郎')).toBeInTheDocument()

    await waitFor(() => {
      const row = [...document.querySelectorAll('tbody tr:not(.table__skeleton)')].find((item) =>
        item.textContent?.includes('検証 太郎'),
      )
      expect(row).toBeDefined()
      const cells = [...(row?.querySelectorAll('td') ?? [])].map((cell) => cell.textContent)
      expect(cells[0]).toBe(TARGET_DATE)
      expect(cells[1]).toBe('Aスタジオ')
      expect(cells[2]).toBe('仮予約')
      expect(cells[3]).toBe('10:00–12:00')
    })
  })

  it('必須項目であることが送信前に示される', async () => {
    renderCreatePage()

    for (const label of [
      '日付',
      'スタジオ',
      '開始時刻',
      '利用時間数',
      '顧客名',
      '電話番号',
      'メールアドレス',
      '用途',
    ]) {
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeRequired()
    }
    expect(screen.getAllByText('必須')).toHaveLength(8)
    expect(screen.getByLabelText('備考')).not.toBeRequired()
  })

  it('電話番号はハイフン付きでも受け付け、数字のみで保存する', async () => {
    const user = userEvent.setup()
    renderCreatePage()

    await fillValidValues(user)
    await user.clear(screen.getByLabelText(/^電話番号/))
    await user.type(screen.getByLabelText(/^電話番号/), '090-0000-1234')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByRole('heading', { name: '予約一覧' })).toBeInTheDocument()
    expect(await screen.findByText('検証 太郎')).toBeInTheDocument()

    // 表示は整形された形式で引ける。
    const created = await listReservations({ keyword: '090-0000-1234', perPage: 100 })
    expect(created.ok && created.value.items[0]?.customerTel).toBe('09000001234')
  })

  it('登録中は重複して送信できない', async () => {
    const user = userEvent.setup()
    renderCreatePage()

    await fillValidValues(user)
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(screen.getByRole('button', { name: '登録中…' })).toBeDisabled()
  })
})

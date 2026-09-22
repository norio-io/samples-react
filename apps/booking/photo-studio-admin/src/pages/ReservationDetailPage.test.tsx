import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Reservation, ReservationStatus } from '../domain/types'
import { AppRoutes } from '../app/AppRoutes'
import { resetMockStore } from '../mock/api'
import { resetMutationFailureRate, setMutationFailureRate } from '../mock/config'
import { createSeedReservations } from '../mock/seed'
import { ReservationStatusOverridesProvider } from '../features/reservations/statusOverrides'
import { ReservationDetailPage } from './ReservationDetailPage'

/** 指定のステータスを持つ初期データを返す。 */
function reservationOfStatus(status: ReservationStatus): Reservation {
  const found = createSeedReservations().find((reservation) => reservation.status === status)
  if (found === undefined) throw new Error(`初期データに ${status} の予約がありません`)
  return found
}

function idOfStatus(status: ReservationStatus): string {
  return reservationOfStatus(status).id
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

/** ステータスの表示値を読む。 */
function statusText(): string {
  const term = screen.getByText('ステータス')
  return term.nextElementSibling?.textContent ?? ''
}

/** 画面を保ったまま予約IDだけを変えられる形で描画する。 */
function renderWithNavigator(fromId: string, toId: string) {
  function Navigator() {
    const navigate = useNavigate()
    return (
      <button type="button" onClick={() => navigate(`/reservations/${toId}`)}>
        次の予約へ
      </button>
    )
  }

  return render(
    <MemoryRouter initialEntries={[`/reservations/${fromId}`]}>
      <ReservationStatusOverridesProvider>
        <Navigator />
        <Routes>
          <Route path="reservations/:reservationId" element={<ReservationDetailPage />} />
        </Routes>
      </ReservationStatusOverridesProvider>
    </MemoryRouter>,
  )
}

/** 顧客名が重ならない2件の予約を返す。1件目は仮予約とする。 */
function twoReservations(): { first: Reservation; second: Reservation } {
  const first = reservationOfStatus('tentative')
  const second = createSeedReservations().find(
    (item) => item.id !== first.id && item.customerName !== first.customerName,
  )
  if (second === undefined) throw new Error('初期データに条件を満たす2件がありません')
  return { first, second }
}

beforeEach(() => {
  resetMockStore()
  setMutationFailureRate(0)
})

afterEach(() => {
  resetMutationFailureRate()
})

describe('ReservationDetailPage', () => {
  it('予約の全項目を表示する', async () => {
    const id = idOfStatus('tentative')
    renderAt(`/reservations/${id}`)

    expect(await screen.findByRole('heading', { name: '予約詳細' })).toBeInTheDocument()
    for (const label of [
      '予約ID',
      'ステータス',
      '日付',
      '時間帯',
      'スタジオ',
      '顧客名',
      '電話番号',
      'メールアドレス',
      '利用目的',
      '備考',
      '受付日時',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText(id)).toBeInTheDocument()
    expect(statusText()).toContain('仮予約')
  })

  it('顧客名と日時を見出し相当へ上げ、操作を画面上部へ置く', async () => {
    const target = reservationOfStatus('tentative')
    renderAt(`/reservations/${target.id}`)

    // 顧客名は見出しとして示す。
    const heading = await screen.findByRole('heading', { level: 2, name: target.customerName })
    const summary = heading.parentElement
    expect(summary).not.toBeNull()
    if (summary === null) return
    // 日時は顧客名と同じ領域へ並べる。
    expect(within(summary).getByText(new RegExp(target.date))).toBeInTheDocument()

    // 操作は内容を読む前に取れるよう、予約情報より前へ置く。
    const action = screen.getByRole('button', { name: '確定する' })
    expect(
      action.compareDocumentPosition(screen.getByText('日付')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // 予約IDは補助情報として、顧客名より後へ下げる。
    expect(
      screen.getByText('予約ID').compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy()
  })

  it('別の予約へ移ると、前の予約を残さず読み込み中から始める', async () => {
    const user = userEvent.setup()
    const { first, second } = twoReservations()
    renderWithNavigator(first.id, second.id)

    // 顧客名は見出しに出る。値そのものは項目にも並ぶため、見出しで見分ける。
    expect(
      await screen.findByRole('heading', { level: 2, name: first.customerName }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '次の予約へ' }))

    // 前の予約の内容を残したまま表示しない。
    expect(
      screen.queryByRole('heading', { level: 2, name: first.customerName }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('読み込み中')).toBeInTheDocument()

    expect(
      await screen.findByRole('heading', { level: 2, name: second.customerName }),
    ).toBeInTheDocument()
  })

  it('更新の応答を待つ間に別の予約へ移っても、移った先の画面が壊れない', async () => {
    const user = userEvent.setup()
    const { first, second } = twoReservations()
    renderWithNavigator(first.id, second.id)

    // 応答（300ms）を待たずに別の予約へ移る。
    await user.click(await screen.findByRole('button', { name: '確定する' }))
    await user.click(screen.getByRole('button', { name: '次の予約へ' }))

    // 移った先が読み込み中のまま止まらない。
    expect(
      await screen.findByRole('heading', { level: 2, name: second.customerName }),
    ).toBeInTheDocument()

    // 前の予約に対する応答が返っても、移った先の表示を書き換えない。
    await waitFor(() => expect(screen.queryByText('更新中…')).not.toBeInTheDocument())
    expect(
      screen.getByRole('heading', { level: 2, name: second.customerName }),
    ).toBeInTheDocument()
    expect(screen.queryByText('読み込み中')).not.toBeInTheDocument()
    // 前の予約の完了は、移った先の画面へ通知しない。
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('存在しない id では画面が壊れず案内を表示する', async () => {
    renderAt('/reservations/rsv-999')

    expect(await screen.findByRole('heading', { name: '予約が見つかりません' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '一覧へ戻る' })).toBeInTheDocument()
  })

  it('現在のステータスから遷移可能な操作のみを提示する', async () => {
    renderAt(`/reservations/${idOfStatus('tentative')}`)
    expect(await screen.findByRole('button', { name: '確定する' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'キャンセルする' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '完了にする' })).not.toBeInTheDocument()
  })

  it('終端のステータスでは操作を提示しない', async () => {
    renderAt(`/reservations/${idOfStatus('completed')}`)
    expect(
      await screen.findByText('このステータスから変更できる操作はありません。'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /する|にする/ })).not.toBeInTheDocument()
  })

  it('成功する更新は応答を待たずに反映される', async () => {
    const user = userEvent.setup()
    renderAt(`/reservations/${idOfStatus('tentative')}`)

    await user.click(await screen.findByRole('button', { name: '確定する' }))

    // 応答（300ms）を待たずに表示が変わる。
    expect(statusText()).toContain('確定')
    expect(screen.getByText('更新中…')).toBeInTheDocument()
    // 更新中は重複して実行できない。
    expect(screen.getByRole('button', { name: '完了にする' })).toBeDisabled()

    await waitFor(() => expect(screen.queryByText('更新中…')).not.toBeInTheDocument())
    expect(statusText()).toContain('確定')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('更新の完了が支援技術へ通知される', async () => {
    const user = userEvent.setup()
    renderAt(`/reservations/${idOfStatus('tentative')}`)

    await user.click(await screen.findByRole('button', { name: '確定する' }))

    const notice = await screen.findByRole('status')
    await waitFor(() => expect(notice).toHaveTextContent('ステータスを確定に変更しました。'))
  })

  it('失敗した更新は直前の状態へ復元し、同一画面で通知する', async () => {
    const user = userEvent.setup()
    setMutationFailureRate(1)
    renderAt(`/reservations/${idOfStatus('tentative')}`)

    await user.click(await screen.findByRole('button', { name: '確定する' }))
    expect(statusText()).toContain('確定')

    expect(await screen.findByRole('alert')).toHaveTextContent('ステータスを更新できませんでした')
    expect(statusText()).toContain('仮予約')
    // 画面遷移を伴わない。
    expect(screen.getByRole('heading', { name: '予約詳細' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '確定する' })).toBeEnabled()
  })

  it('キャンセルは実行前に確認を求める', async () => {
    const user = userEvent.setup()
    renderAt(`/reservations/${idOfStatus('tentative')}`)

    await user.click(await screen.findByRole('button', { name: 'キャンセルする' }))

    const dialog = screen.getByRole('alertdialog', { name: '操作の確認' })
    expect(dialog).toHaveTextContent('元に戻せません')
    // 確認の時点では変更されない。
    expect(statusText()).toContain('仮予約')

    await user.click(within(dialog).getByRole('button', { name: 'やめる' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(statusText()).toContain('仮予約')

    await user.click(screen.getByRole('button', { name: 'キャンセルする' }))
    await user.click(
      within(screen.getByRole('alertdialog', { name: '操作の確認' })).getByRole('button', {
        name: 'キャンセルにする',
      }),
    )
    // 楽観的更新のため表示は即座に変わる。後続のテストへ影響しないよう、
    // 応答が確定するまで待つ。
    await waitFor(() => expect(statusText()).toContain('キャンセル'))
    // キャンセルは終端であり操作ボタンが消えるため、焦点は通知領域へ移る。
    expect(screen.getByRole('status')).toHaveFocus()
    await waitFor(() => expect(screen.queryByText('更新中…')).not.toBeInTheDocument())
  })

  it('確認を開くと焦点が移り、Escape と「やめる」で呼び出し元へ戻る', async () => {
    const user = userEvent.setup()
    renderAt(`/reservations/${idOfStatus('tentative')}`)

    const trigger = await screen.findByRole('button', { name: 'キャンセルする' })
    await user.click(trigger)

    const dialog = screen.getByRole('alertdialog', { name: '操作の確認' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleDescription(/元に戻せません/)
    // 確認が現れたことが伝わるよう、確認の操作へ焦点を移す。
    expect(within(dialog).getByRole('button', { name: 'キャンセルにする' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(statusText()).toContain('仮予約')

    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('一覧へ戻ると検索条件が保持される', async () => {
    const user = userEvent.setup()
    const id = idOfStatus('tentative')
    renderAt(`/reservations/${id}?list=${encodeURIComponent('status=tentative&page=2')}`)

    await user.click(await screen.findByRole('link', { name: '← 一覧へ戻る' }))

    expect(await screen.findByRole('heading', { name: '予約一覧' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('仮予約')).toBeChecked())
    expect(await screen.findByText(/ページ 2 \//)).toBeInTheDocument()
  })

  it('戻り先の条件が不正でも一覧が壊れない', async () => {
    const user = userEvent.setup()
    renderAt(`/reservations/${idOfStatus('tentative')}?list=${encodeURIComponent('status=zzz&page=abc')}`)

    await user.click(await screen.findByRole('link', { name: '← 一覧へ戻る' }))

    expect(await screen.findByRole('heading', { name: '予約一覧' })).toBeInTheDocument()
    expect(await screen.findByText(/80件中 1–20件/)).toBeInTheDocument()
  })

  it('失敗した更新の復元は一覧の表示にも反映される', async () => {
    const user = userEvent.setup()
    const target = reservationOfStatus('tentative')
    setMutationFailureRate(1)
    renderAt(
      `/reservations/${target.id}?list=${encodeURIComponent(`q=${target.customerEmail}`)}`,
    )

    await user.click(await screen.findByRole('button', { name: '確定する' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: '← 一覧へ戻る' }))
    expect(await screen.findByRole('heading', { name: '予約一覧' })).toBeInTheDocument()

    // 一覧でも直前の状態のままであること。
    await waitFor(() => {
      const rows = [...document.querySelectorAll('tbody tr:not(.table__skeleton)')]
      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0]?.querySelectorAll('td')[2]?.textContent).toBe('仮予約')
    })
  })

  it('成功した更新は一覧の表示にも反映される', async () => {
    const user = userEvent.setup()
    const target = reservationOfStatus('tentative')
    renderAt(
      `/reservations/${target.id}?list=${encodeURIComponent(`q=${target.customerEmail}`)}`,
    )

    await user.click(await screen.findByRole('button', { name: '確定する' }))
    await waitFor(() => expect(screen.queryByText('更新中…')).not.toBeInTheDocument())

    await user.click(screen.getByRole('link', { name: '← 一覧へ戻る' }))
    expect(await screen.findByRole('heading', { name: '予約一覧' })).toBeInTheDocument()

    await waitFor(() => {
      const rows = [...document.querySelectorAll('tbody tr:not(.table__skeleton)')]
      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0]?.querySelectorAll('td')[2]?.textContent).toBe('確定')
    })
  })
})

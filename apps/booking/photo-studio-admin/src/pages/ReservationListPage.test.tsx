import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetMockStore } from '../mock/api'
import { ReservationListPage } from './ReservationListPage'

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(
    <BrowserRouter>
      <ReservationListPage />
    </BrowserRouter>,
  )
}

/** 一覧の行が描画されるまで待ち、本体の行を返す。 */
async function findRows(): Promise<HTMLElement[]> {
  const table = await screen.findByRole('table')
  await waitFor(() => {
    expect(table.querySelectorAll('tbody tr').length).toBeGreaterThan(0)
  })
  return [...table.querySelectorAll<HTMLElement>('tbody tr')]
}

function currentSearch(): URLSearchParams {
  return new URLSearchParams(window.location.search)
}

function cellsOf(row: Element): string[] {
  return [...row.querySelectorAll('td')].map((cell) => cell.textContent ?? '')
}

beforeEach(() => {
  resetMockStore()
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  window.history.pushState({}, '', '/')
})

describe('ReservationListPage', () => {
  it('URLの条件で検索結果を復元する', async () => {
    renderAt('/?studio=studio-b&status=confirmed')
    await findRows()

    await waitFor(() => {
      const rows = [...document.querySelectorAll('tbody tr')]
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        const cells = cellsOf(row)
        expect(cells[1]).toBe('Bスタジオ')
        expect(cells[2]).toBe('確定')
      }
    })
  })

  it('絞り込みの選択状態がURLから復元される', async () => {
    renderAt('/?studio=studio-b&status=confirmed&from=2026-09-01')
    await findRows()

    expect(await screen.findByLabelText('Bスタジオ')).toBeChecked()
    expect(screen.getByLabelText('確定')).toBeChecked()
    expect(screen.getByLabelText('仮予約')).not.toBeChecked()
    expect(screen.getByLabelText('開始日')).toHaveValue('2026-09-01')
  })

  it('ページ番号がURLから復元される', async () => {
    renderAt('/?page=2')
    expect(await screen.findByText(/ページ 2 \//)).toBeInTheDocument()
    expect(await screen.findByText(/80件中 21–40件/)).toBeInTheDocument()
  })

  it('不正なパラメータでも画面が壊れず既定値へフォールバックする', async () => {
    renderAt('/?from=yesterday&to=2026-02-31&studio=studio-x&status=unknown&sort=bogus&order=up&page=abc&%%%=1')
    const rows = await findRows()

    expect(screen.getByRole('heading', { name: '予約一覧' })).toBeInTheDocument()
    expect(rows.length).toBe(20)
    expect(await screen.findByText(/80件中 1–20件/)).toBeInTheDocument()
    expect(screen.getByLabelText('開始日')).toHaveValue('')
  })

  it('並び替えの切り替えがURLへ反映される', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await findRows()

    await user.click(screen.getByRole('button', { name: /スタジオ/ }))
    await waitFor(() => expect(currentSearch().get('sort')).toBe('studio'))
    expect(currentSearch().get('order')).toBeNull()

    await user.click(screen.getByRole('button', { name: /スタジオ/ }))
    await waitFor(() => expect(currentSearch().get('order')).toBe('desc'))

    const header = screen.getByRole('columnheader', { name: /スタジオ/ })
    expect(header).toHaveAttribute('aria-sort', 'descending')
  })

  it('ページ送りがURLへ反映される', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await findRows()

    await user.click(screen.getByRole('button', { name: '次へ' }))
    await waitFor(() => expect(currentSearch().get('page')).toBe('2'))
    expect(await screen.findByText(/80件中 21–40件/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '前へ' }))
    // 既定値はURLへ出力しない。
    await waitFor(() => expect(currentSearch().get('page')).toBeNull())
  })

  it('既定値と同一の条件はURLへ出力しない', async () => {
    const user = userEvent.setup()
    renderAt('/?studio=studio-a')
    await findRows()

    await user.click(screen.getByLabelText('Aスタジオ'))
    await waitFor(() => expect(window.location.search).toBe(''))
  })

  it('顧客名の入力では打鍵ごとに履歴を積まない', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await findRows()

    // 履歴へ積まれる操作を1つ行い、その手前の状態へ戻れることを確認する。
    await user.click(screen.getByRole('button', { name: /スタジオ/ }))
    await waitFor(() => expect(currentSearch().get('sort')).toBe('studio'))

    await user.type(screen.getByLabelText('顧客名'), '相川')
    await waitFor(() => expect(currentSearch().get('q')).toBe('相川'), { timeout: 3000 })

    window.history.back()

    // 打鍵ごとに履歴が積まれていれば、戻り先は入力途中のURLとなる。
    await waitFor(() => expect(window.location.search).toBe(''), { timeout: 3000 })
  })

  it('顧客名の入力が検索結果へ反映される', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await findRows()

    await user.type(screen.getByLabelText('顧客名'), '商品撮影')
    await waitFor(() => expect(currentSearch().get('q')).toBe('商品撮影'), { timeout: 3000 })

    await waitFor(() => {
      const rows = [...document.querySelectorAll('tbody tr')]
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(cellsOf(row)[5]).toBe('商品撮影')
      }
    })
  })

  it('各行から詳細画面へ遷移できる', async () => {
    const rows = await (async () => {
      renderAt('/')
      return findRows()
    })()

    const firstRow = rows[0]
    expect(firstRow).toBeDefined()
    if (firstRow === undefined) return
    const link = within(firstRow).getByRole('link')
    expect(link.getAttribute('href')).toMatch(/^\/reservations\/rsv-\d{3}$/)
  })
})

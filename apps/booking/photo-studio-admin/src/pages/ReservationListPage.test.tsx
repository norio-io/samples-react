import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetMockStore } from '../mock/api'
import { ReservationStatusOverridesProvider } from '../features/reservations/statusOverrides'
import { ReservationListPage } from './ReservationListPage'

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(
    <BrowserRouter>
      <ReservationStatusOverridesProvider>
        <ReservationListPage />
      </ReservationStatusOverridesProvider>
    </BrowserRouter>,
  )
}

/** 一覧の行が描画されるまで待ち、本体の行を返す。 */
async function findRows(): Promise<HTMLElement[]> {
  const table = await screen.findByRole('table')
  await waitFor(() => {
    expect(table.querySelectorAll('tbody tr:not(.table__skeleton)').length).toBeGreaterThan(0)
  })
  return [...table.querySelectorAll<HTMLElement>('tbody tr:not(.table__skeleton)')]
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
      const rows = [...document.querySelectorAll('tbody tr:not(.table__skeleton)')]
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

  it('範囲外のページ番号は応答に合わせて丸められ、URLが履歴を積まずに追従する', async () => {
    renderAt('/?page=999')

    expect(await screen.findByText(/80件中 61–80件/)).toBeInTheDocument()
    expect(screen.getByText(/ページ 4 \/ 4/)).toBeInTheDocument()
    await waitFor(() => expect(currentSearch().get('page')).toBe('4'))

    // 追従は replace で行うため、戻り先は一覧を開く前の状態となる。
    window.history.back()
    await waitFor(() => expect(window.location.search).toBe(''), { timeout: 3000 })
  })

  it('丸められたページからページ送りできる', async () => {
    const user = userEvent.setup()
    renderAt('/?page=999')
    await waitFor(() => expect(currentSearch().get('page')).toBe('4'))

    await user.click(screen.getByRole('button', { name: '前へ' }))
    await waitFor(() => expect(currentSearch().get('page')).toBe('3'))
    expect(await screen.findByText(/80件中 41–60件/)).toBeInTheDocument()
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

  it('キーワードの入力では打鍵ごとに履歴を積まない', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await findRows()

    // 履歴へ積まれる操作を1つ行い、その手前の状態へ戻れることを確認する。
    await user.click(screen.getByRole('button', { name: /スタジオ/ }))
    await waitFor(() => expect(currentSearch().get('sort')).toBe('studio'))

    await user.type(screen.getByLabelText('顧客名・連絡先・用途'), '相川')
    await waitFor(() => expect(currentSearch().get('q')).toBe('相川'), { timeout: 3000 })

    window.history.back()

    // 打鍵ごとに履歴が積まれていれば、戻り先は入力途中のURLとなる。
    await waitFor(() => expect(window.location.search).toBe(''), { timeout: 3000 })
  })

  it('キーワードの入力が検索結果へ反映される', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await findRows()

    await user.type(screen.getByLabelText('顧客名・連絡先・用途'), '商品撮影')
    await waitFor(() => expect(currentSearch().get('q')).toBe('商品撮影'), { timeout: 3000 })

    await waitFor(() => {
      const rows = [...document.querySelectorAll('tbody tr:not(.table__skeleton)')]
      expect(rows.length).toBeGreaterThan(0)
      for (const row of rows) {
        expect(cellsOf(row)[5]).toBe('商品撮影')
      }
    })
  })

  it('キーワードは顧客名以外の項目でも引ける', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await findRows()

    // 電話番号での検索。ラベルが示す対象と実際の絞り込みが一致していること。
    await user.type(screen.getByLabelText('顧客名・連絡先・用途'), '090-0000-1000')
    await waitFor(() => expect(currentSearch().get('q')).toBe('090-0000-1000'), { timeout: 3000 })

    await waitFor(() => {
      const rows = [...document.querySelectorAll('tbody tr:not(.table__skeleton)')]
      expect(rows).toHaveLength(1)
    })
  })

  it('初回読込では一覧と同じ形状のプレースホルダを表示する', async () => {
    renderAt('/')

    const table = screen.getByRole('table')
    expect(table).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('読み込み中')).toBeInTheDocument()

    const skeletonRows = table.querySelectorAll('tbody tr.table__skeleton')
    expect(skeletonRows).toHaveLength(20)
    // 列の数は一覧と同じであり、読込完了時に形状が変わらない。
    expect(skeletonRows[0]?.querySelectorAll('td')).toHaveLength(6)

    await findRows()
    expect(table.querySelectorAll('tbody tr.table__skeleton')).toHaveLength(0)
    expect(table).toHaveAttribute('aria-busy', 'false')
  })

  it('該当なしの場合は絞り込みの解除手段を示す', async () => {
    const user = userEvent.setup()
    renderAt('/?q=該当しない文字列')

    expect(await screen.findByText('条件に合致する予約はありません。')).toBeInTheDocument()
    expect(screen.getByText('該当する予約はありません')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'ページ送り' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '絞り込みを解除する' }))
    await waitFor(() => expect(window.location.search).toBe(''))
    expect((await findRows()).length).toBe(20)
  })

  it('条件の変更による再取得中は直前の結果を表示したまま取得中を示す', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const before = await findRows()
    const firstCustomer = before[0]?.textContent ?? ''

    await user.click(screen.getByRole('button', { name: '次へ' }))

    // 初回読込とは異なり、プレースホルダへ戻さず直前の結果を保つ。
    const table = screen.getByRole('table')
    expect(table).toHaveAttribute('aria-busy', 'true')
    expect(table.querySelectorAll('tbody tr.table__skeleton')).toHaveLength(0)
    expect(screen.getByText('更新中…')).toBeInTheDocument()
    expect(table.querySelector('tbody tr')?.textContent).toBe(firstCustomer)

    expect(await screen.findByText(/80件中 21–40件/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('更新中…')).not.toBeInTheDocument())
  })

  it('再取得中でも続けてページ送りできる', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await findRows()

    const next = screen.getByRole('button', { name: '次へ' })
    await user.click(next)
    // 応答が届く前の操作でも、要求中のページ番号を基準に進む。
    await user.click(next)

    await waitFor(() => expect(currentSearch().get('page')).toBe('3'))
    expect(await screen.findByText(/80件中 41–60件/)).toBeInTheDocument()
  })

  it('絞り込みから行選択、ページ送りまでをキーボードで操作できる', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await findRows()

    // 絞り込み
    await user.click(screen.getByLabelText('Aスタジオ'))
    await waitFor(() => expect(currentSearch().get('studio')).toBe('studio-a'))

    // 並び替え（焦点を当てて Enter）
    screen.getByRole('button', { name: /スタジオ/ }).focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(currentSearch().get('sort')).toBe('studio'))

    // ページ送り
    screen.getByRole('button', { name: '次へ' }).focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(currentSearch().get('page')).toBe('2'))

    // 行の選択はリンクであり、キーボードで到達できる
    const rows = await findRows()
    const link = within(rows[0] as HTMLElement).getByRole('link')
    link.focus()
    expect(link).toHaveFocus()
  })

  it('表の横スクロールは表領域内に限定される', async () => {
    renderAt('/')
    await findRows()

    const table = screen.getByRole('table')
    expect(table.parentElement).toHaveClass('table-wrapper')
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

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from './AppRoutes'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('AppRoutes', () => {
  it('基点では予約一覧を表示する', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: '予約一覧' })).toBeInTheDocument()
  })

  it('予約詳細のパスを解決する', async () => {
    renderAt('/reservations/rsv-001')
    expect(await screen.findByRole('heading', { name: '予約詳細' })).toBeInTheDocument()
    expect(screen.getByText('rsv-001')).toBeInTheDocument()
  })

  it('未定義のパスでは案内を表示する', () => {
    renderAt('/unknown')
    expect(screen.getByRole('heading', { name: 'ページが見つかりません' })).toBeInTheDocument()
  })

  it('架空の題材である旨を画面上に表示する', () => {
    renderAt('/')
    expect(screen.getByText(/架空の題材/)).toBeInTheDocument()
  })
})

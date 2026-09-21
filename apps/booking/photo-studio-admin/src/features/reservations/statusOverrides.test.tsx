import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Reservation } from '../../domain/types'
import { ReservationStatusOverridesProvider } from './statusOverrides'
import { effectiveStatus, useStatusOverrides } from './statusOverridesContext'

const RESERVATION: Reservation = {
  id: 'rsv-001',
  studioId: 'studio-a',
  date: '2026-09-21',
  startHour: 10,
  hours: 2,
  customerName: '相川 陽向',
  customerTel: '090-0000-1000',
  customerEmail: 'guest001@example.com',
  purpose: '家族写真',
  status: 'tentative',
  createdAt: '2026-09-18T09:00:00.000Z',
}

/** 一覧と詳細の双方が同じ値を参照することを模した表示。 */
function Probe() {
  const { overrides, apply, revert } = useStatusOverrides()

  return (
    <div>
      <span data-testid="status">{effectiveStatus(RESERVATION, overrides)}</span>
      <button type="button" onClick={() => apply(RESERVATION.id, 'confirmed')}>
        楽観的に反映
      </button>
      <button type="button" onClick={() => revert(RESERVATION.id)}>
        取り消し
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <ReservationStatusOverridesProvider>
      <Probe />
      <Probe />
    </ReservationStatusOverridesProvider>,
  )
}

describe('ステータスの楽観的更新', () => {
  it('反映は同じ provider を参照するすべての表示へ及ぶ', async () => {
    const user = userEvent.setup()
    renderProbe()

    const [first, second] = screen.getAllByTestId('status')
    expect(first).toHaveTextContent('tentative')
    expect(second).toHaveTextContent('tentative')

    await user.click(screen.getAllByRole('button', { name: '楽観的に反映' })[0] as HTMLElement)

    expect(screen.getAllByTestId('status')[0]).toHaveTextContent('confirmed')
    expect(screen.getAllByTestId('status')[1]).toHaveTextContent('confirmed')
  })

  it('取り消しは直前の状態へ戻す', async () => {
    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getAllByRole('button', { name: '楽観的に反映' })[0] as HTMLElement)
    expect(screen.getAllByTestId('status')[0]).toHaveTextContent('confirmed')

    await user.click(screen.getAllByRole('button', { name: '取り消し' })[1] as HTMLElement)
    expect(screen.getAllByTestId('status')[0]).toHaveTextContent('tentative')
    expect(screen.getAllByTestId('status')[1]).toHaveTextContent('tentative')
  })

  it('provider の外では利用できない', () => {
    expect(() => render(<Probe />)).toThrowError(
      /ReservationStatusOverridesProvider の内側で使用してください/,
    )
  })
})

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Reservation } from '../domain/types'
import type * as ApiModule from '../mock/api'
import { listReservations, listStudios, type ReservationListResult } from '../mock/api'
import { fail, ok, type Result } from '../mock/result'
import { STUDIOS } from '../mock/seed'
import { ReservationListPage } from './ReservationListPage'

// 応答の内容と到着順を制御するため、モックAPIそのものを差し替える。
vi.mock('../mock/api', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiModule>()
  return { ...actual, listReservations: vi.fn(), listStudios: vi.fn() }
})

const listReservationsMock = vi.mocked(listReservations)
const listStudiosMock = vi.mocked(listStudios)

function reservationOf(customerName: string): Reservation {
  return {
    id: 'rsv-001',
    studioId: 'studio-a',
    date: '2026-09-21',
    startHour: 10,
    hours: 2,
    customerName,
    customerTel: '090-0000-1000',
    customerEmail: 'guest001@example.com',
    purpose: '家族写真',
    status: 'confirmed',
    createdAt: '2026-09-18T09:00:00.000Z',
  }
}

function resultOf(customerName: string, page = 1, total = 1): ReservationListResult {
  return {
    items: [reservationOf(customerName)],
    total,
    page,
    perPage: 20,
    totalPages: Math.max(1, Math.ceil(total / 20)),
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(
    <BrowserRouter>
      <ReservationListPage />
    </BrowserRouter>,
  )
}

beforeEach(() => {
  listStudiosMock.mockResolvedValue(ok(STUDIOS.map((studio) => ({ ...studio }))))
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.clearAllMocks()
  window.history.pushState({}, '', '/')
})

describe('ReservationListPage の非同期状態', () => {
  it('取得に失敗した場合は原因と再試行の手段を示し、再試行で検索条件を保持する', async () => {
    const user = userEvent.setup()
    listReservationsMock
      .mockResolvedValueOnce(
        fail<ReservationListResult>('TEMPORARY_FAILURE', '一覧を取得できませんでした。'),
      )
      .mockResolvedValueOnce(ok(resultOf('相川 陽向', 2, 50)))

    renderAt('/?q=相川&page=2')

    expect(await screen.findByRole('alert')).toHaveTextContent('一覧を取得できませんでした。')
    expect(screen.getByText('取得に失敗しました')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '再試行' }))

    expect(await screen.findByText('相川 陽向')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // 再試行は同一の検索条件で行う。URL も変化しない。
    expect(listReservationsMock).toHaveBeenCalledTimes(2)
    expect(listReservationsMock.mock.calls[1]?.[0]).toEqual(listReservationsMock.mock.calls[0]?.[0])
    expect(listReservationsMock.mock.calls[0]?.[0]).toMatchObject({ keyword: '相川', page: 2 })
    expect(new URLSearchParams(window.location.search).get('q')).toBe('相川')
    expect(new URLSearchParams(window.location.search).get('page')).toBe('2')
  })

  it('古い応答は新しい応答を上書きしない', async () => {
    const user = userEvent.setup()
    const first = deferred<Result<ReservationListResult>>()
    const second = deferred<Result<ReservationListResult>>()
    listReservationsMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    renderAt('/')
    await waitFor(() => expect(listReservationsMock).toHaveBeenCalledTimes(1))

    // 1件目の応答が返る前に条件を変更し、2件目の要求を発生させる。
    await user.click(screen.getByRole('button', { name: /スタジオ/ }))
    await waitFor(() => expect(listReservationsMock).toHaveBeenCalledTimes(2))

    second.resolve(ok(resultOf('新しい 結果')))
    expect(await screen.findByText('新しい 結果')).toBeInTheDocument()

    // 後から届いた古い応答で表示が入れ替わらないこと。
    first.resolve(ok(resultOf('古い 結果')))
    await new Promise((settle) => {
      setTimeout(settle, 0)
    })

    expect(screen.queryByText('古い 結果')).not.toBeInTheDocument()
    expect(screen.getByText('新しい 結果')).toBeInTheDocument()
  })
})

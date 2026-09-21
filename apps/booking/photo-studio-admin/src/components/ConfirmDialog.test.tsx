import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { APP_CONTENT_ID } from '../app/appContent'
import { ConfirmDialog } from './ConfirmDialog'

function Host({
  onConfirm = vi.fn(),
  removeTriggerOnConfirm = false,
}: {
  onConfirm?: () => void
  removeTriggerOnConfirm?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [triggerRemoved, setTriggerRemoved] = useState(false)
  const fallbackRef = useRef<HTMLParagraphElement | null>(null)

  return (
    <div>
      <div id={APP_CONTENT_ID}>
        <p tabIndex={-1} ref={fallbackRef}>
          通知領域
        </p>
        {!triggerRemoved && (
          <button type="button" onClick={() => setOpen(true)}>
            開く
          </button>
        )}
        <a href="/other">背面のリンク</a>
      </div>
      {open && (
        <ConfirmDialog
          title="操作の確認"
          description="元に戻せません。よろしいですか？"
          confirmLabel="実行する"
          fallbackFocusRef={fallbackRef}
          onConfirm={() => {
            onConfirm()
            // 操作の結果、呼び出し元のボタンが取り除かれる場合を模す。
            if (removeTriggerOnConfirm) setTriggerRemoved(true)
            setOpen(false)
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </div>
  )
}

describe('ConfirmDialog', () => {
  it('開いた際に確認の操作へ焦点を移す', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.click(screen.getByRole('button', { name: '開く' }))
    expect(screen.getByRole('button', { name: '実行する' })).toHaveFocus()
  })

  it('Tab の焦点が内側で循環する', async () => {
    const user = userEvent.setup()
    render(<Host />)

    await user.click(screen.getByRole('button', { name: '開く' }))
    const confirm = screen.getByRole('button', { name: '実行する' })
    const cancel = screen.getByRole('button', { name: 'やめる' })

    await user.tab()
    expect(cancel).toHaveFocus()

    // 末尾からは先頭へ戻る。
    await user.tab()
    expect(confirm).toHaveFocus()

    // 先頭から遡ると末尾へ移る。
    await user.tab({ shift: true })
    expect(cancel).toHaveFocus()
  })

  it('背面を操作・読み上げの対象から外す', async () => {
    const user = userEvent.setup()
    render(<Host />)
    const content = document.getElementById(APP_CONTENT_ID)

    expect(content).not.toHaveAttribute('inert')

    await user.click(screen.getByRole('button', { name: '開く' }))
    expect(content).toHaveAttribute('inert')
    expect(content).toHaveAttribute('aria-hidden', 'true')

    await user.keyboard('{Escape}')
    expect(content).not.toHaveAttribute('inert')
    expect(content).not.toHaveAttribute('aria-hidden')
  })

  it('Escape で閉じ、呼び出し元へ焦点を戻す', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Host onConfirm={onConfirm} />)

    const trigger = screen.getByRole('button', { name: '開く' })
    await user.click(trigger)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('確認の操作を実行できる', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<Host onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: '開く' }))
    await user.keyboard('{Enter}')
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('呼び出し元が取り除かれた場合は代わりの移動先へ焦点を移す', async () => {
    const user = userEvent.setup()
    render(<Host removeTriggerOnConfirm />)

    await user.click(screen.getByRole('button', { name: '開く' }))
    await user.keyboard('{Enter}')

    expect(screen.queryByRole('button', { name: '開く' })).not.toBeInTheDocument()
    // 焦点が body へ外れない。
    expect(screen.getByText('通知領域')).toHaveFocus()
    expect(document.body).not.toHaveFocus()
  })
})

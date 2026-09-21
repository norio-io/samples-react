import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { APP_CONTENT_ID } from '../app/appContent'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  /**
   * 閉じた際に呼び出し元が取り除かれている場合の、焦点の移動先。
   * 操作の結果、呼び出し元のボタン自体が消える場合に用いる。
   */
  fallbackFocusRef?: RefObject<HTMLElement | null>
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 取り消せない操作の確認。
 *
 * 焦点を内側に捕捉し、Escape で閉じ、閉じた際は呼び出し元へ戻す。
 * 背面は inert と aria-hidden で操作・読み上げの対象から外す。
 * 背面を不活性化するため、本体は body へ描画する。
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = 'やめる',
  busy = false,
  fallbackFocusRef,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)

  // 開いた際に確認の操作へ焦点を移し、閉じた際は呼び出し元へ戻す。
  // 操作の結果として呼び出し元が取り除かれている場合は、焦点が body へ
  // 外れてしまうため、代わりの移動先へ移す。
  const fallbackRef = useRef(fallbackFocusRef)
  fallbackRef.current = fallbackFocusRef

  useEffect(() => {
    const previous = document.activeElement
    confirmRef.current?.focus()
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus()
        return
      }
      fallbackRef.current?.current?.focus()
    }
  }, [])

  // 背面を操作・読み上げの対象から外す。
  useEffect(() => {
    const content = document.getElementById(APP_CONTENT_ID)
    if (content === null) return
    content.setAttribute('inert', '')
    content.setAttribute('aria-hidden', 'true')
    return () => {
      content.removeAttribute('inert')
      content.removeAttribute('aria-hidden')
    }
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])]
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) return

      // 焦点を内側で循環させる。
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onCancel],
  )

  return createPortal(
    <div className="dialog__overlay">
      <div
        ref={dialogRef}
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        onKeyDown={handleKeyDown}
      >
        <h2 id="confirm-title" className="dialog__title">
          {title}
        </h2>
        <p id="confirm-description">{description}</p>
        <div className="dialog__actions">
          <button ref={confirmRef} type="button" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

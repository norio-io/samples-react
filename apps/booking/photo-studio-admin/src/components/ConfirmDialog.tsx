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

  /**
   * 焦点の移動先の控え。
   *
   * 後始末は解除時にのみ実行するため、副作用の依存は空とする。その中から
   * 最新の値を読めるよう ref へ写すが、書き込みは描画中ではなく副作用で行う。
   */
  const fallbackRef = useRef(fallbackFocusRef)
  useEffect(() => {
    fallbackRef.current = fallbackFocusRef
  })

  /**
   * 背面の不活性化と焦点の制御。
   *
   * 後始末は宣言の順に実行されるため、別々の副作用に分けると背面へ
   * `inert` が残ったまま焦点を戻すことになり、`inert` の内側の要素は焦点を
   * 受け取れないため焦点が body へ外れる。順序を明示するため一つにまとめ、
   * 不活性化の解除を焦点の復帰より先に行う。
   */
  useEffect(() => {
    const previous = document.activeElement
    const content = document.getElementById(APP_CONTENT_ID)

    content?.setAttribute('inert', '')
    content?.setAttribute('aria-hidden', 'true')
    confirmRef.current?.focus()

    return () => {
      // 焦点を戻す前に背面を通常の状態へ戻す。
      content?.removeAttribute('inert')
      content?.removeAttribute('aria-hidden')

      // 操作の結果として呼び出し元が取り除かれている場合は、
      // 代わりの移動先へ移す。
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus()
        return
      }
      fallbackRef.current?.current?.focus()
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
          {/* 取り消せない操作の実行であるため、警告色の主操作として示す。 */}
          <button
            ref={confirmRef}
            type="button"
            className="button button--danger-strong"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button type="button" className="button button--secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

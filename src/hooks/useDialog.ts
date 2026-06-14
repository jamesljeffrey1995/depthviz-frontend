import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    el =>
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-hidden') !== 'true' &&
      // offsetParent is null for display:none / detached nodes.
      (el.offsetParent !== null || el === document.activeElement),
  )
}

/**
 * Accessible modal-dialog behaviour for an overlay: ESC to close, a focus trap
 * that keeps Tab inside the dialog, initial focus on open, focus restoration on
 * close, and a background-scroll lock.
 *
 * The focusable set is recomputed on every Tab (not cached once) so dialogs
 * whose content changes — a QR canvas or native-share button appearing, a
 * form step revealing new fields — keep correct trap boundaries. Disabled and
 * hidden controls are excluded, and an empty set is handled without throwing
 * (the previous hand-rolled traps called `.focus()` on `undefined`).
 *
 * Attach the returned ref to the dialog element and give it
 * `role="dialog" aria-modal="true"`.
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
): React.RefObject<T | null> {
  const ref = useRef<T>(null)
  // Keep the latest onClose without re-running the effect (which would reset
  // focus and tear down the scroll lock on every parent re-render).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = getFocusable(dialog)
      if (focusable.length === 0) {
        // Nothing to focus — keep focus on the dialog itself rather than
        // letting Tab escape to the page behind.
        e.preventDefault()
        dialog.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    // Move focus into the dialog (first focusable, else the container).
    const focusable = getFocusable(dialog)
    ;(focusable[0] ?? dialog).focus()

    // Lock background scroll.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [])

  return ref
}

import type { KeyboardEvent } from 'react'

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href]'

export const keepTabInside = (event: KeyboardEvent, dialog: HTMLElement | null): void => {
  if (event.key !== 'Tab' || !dialog) return
  const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
  const first = items[0]
  const last = items.at(-1)
  if (!first || !last) return
  const atStart = document.activeElement === first || document.activeElement === dialog
  if (event.shiftKey && atStart) {
    event.preventDefault()
    last.focus()
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

export const focusedBefore = (): HTMLElement | null => (document.activeElement instanceof HTMLElement ? document.activeElement : null)

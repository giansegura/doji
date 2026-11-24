const TEXT_FIELDS = ['INPUT', 'TEXTAREA', 'SELECT']

export const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (TEXT_FIELDS.includes(target.tagName) || target.isContentEditable)

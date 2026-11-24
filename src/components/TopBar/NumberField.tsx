import { useState } from 'react'
import * as Styles from './styles'

type NumberFieldProps = {
  label: string
  value: number
  min: number
  max: number
  decimal?: boolean
  onChange: (value: number) => void
}

export const NumberField = ({ label, value, min, max, decimal = false, onChange }: NumberFieldProps) => {
  const [text, setText] = useState(String(value))

  const handleChange = (next: string) => {
    setText(next)
    const parsed = decimal ? Number.parseFloat(next) : Number.parseInt(next, 10)
    if (Number.isNaN(parsed)) return
    onChange(Math.min(max, Math.max(min, parsed)))
  }

  return (
    <Styles.NumberInput
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step={decimal ? 'any' : undefined}
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={() => setText(String(value))}
    />
  )
}

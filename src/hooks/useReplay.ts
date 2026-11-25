import { useCallback, useEffect, useRef, useState } from 'react'
import type { Bar, Timeframe } from '../../shared/types'
import { type ReplayState, startOfReplay, stepReplay } from '../domain/replay'
import { isTyping } from '../domain/typing'

type ReplayArgs = { bars: Bar[]; timeframe: Timeframe; symbol: string }

const OFF: ReplayState = { status: 'off' }
const SECOND_MS = 1000
const FIRST_SPEED = 1

export const useReplay = ({ bars, timeframe, symbol }: ReplayArgs) => {
  const [replay, setReplay] = useState<ReplayState>(OFF)
  const latest = useRef({ bars, timeframe })
  const speedRef = useRef(FIRST_SPEED)

  useEffect(() => {
    latest.current = { bars, timeframe }
  })

  useEffect(() => {
    setReplay(OFF)
  }, [symbol])

  const start = useCallback(() => setReplay({ status: 'picking' }), [])

  const exit = useCallback(() => setReplay(OFF), [])

  const pick = useCallback((date: string, pickedOn?: Timeframe) => {
    const cutoff = startOfReplay(latest.current.bars, pickedOn ?? latest.current.timeframe, date)
    if (cutoff) setReplay({ status: 'on', cutoff, playing: false, speed: speedRef.current })
  }, [])

  const step = useCallback(
    () =>
      setReplay((current) => {
        if (current.status !== 'on') return current
        const next = stepReplay(latest.current.bars, latest.current.timeframe, current.cutoff)
        return next ? { ...current, cutoff: next } : { ...current, playing: false }
      }),
    [],
  )

  const togglePlay = useCallback(() => setReplay((current) => (current.status === 'on' ? { ...current, playing: !current.playing } : current)), [])

  const setSpeed = useCallback((speed: number) => {
    speedRef.current = speed
    setReplay((current) => (current.status === 'on' ? { ...current, speed } : current))
  }, [])

  const playing = replay.status === 'on' && replay.playing
  const speed = replay.status === 'on' ? replay.speed : FIRST_SPEED

  useEffect(() => {
    if (!playing) return undefined
    const timer = setInterval(step, SECOND_MS / speed)
    return () => clearInterval(timer)
  }, [playing, speed, step])

  const active = replay.status !== 'off'

  useEffect(() => {
    if (!active) return undefined
    const handleKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      if (event.key === 'ArrowRight') step()
      if (event.key === 'Escape') exit()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [active, step, exit])

  return { replay, start, pick, step, togglePlay, setSpeed, exit }
}

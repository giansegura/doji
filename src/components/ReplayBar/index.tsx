import type { ReplayState } from '../../domain/replay'
import * as Styles from './styles'

type ReplayBarProps = {
  replay: Exclude<ReplayState, { status: 'off' }>
  onPickAgain: () => void
  onStep: () => void
  onTogglePlay: () => void
  onSpeed: (speed: number) => void
  onExit: () => void
}

const SPEEDS = [1, 3, 10]
const DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <path d="M4 2.5v9l7.5-4.5z" />
  </svg>
)

const PauseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <path d="M3.5 2.5h2.5v9H3.5zM8 2.5h2.5v9H8z" />
  </svg>
)

const StepIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
    <path d="M3 2.5v9l6-4.5zM10 2.5h1.5v9H10z" />
  </svg>
)

export const ReplayBar = ({ replay, onPickAgain, onStep, onTogglePlay, onSpeed, onExit }: ReplayBarProps) => (
  <Styles.Bar role="toolbar" aria-label="Replay">
    {replay.status === 'picking' ? (
      <Styles.Message role="status">Click a bar on the chart to start the replay from it.</Styles.Message>
    ) : (
      <>
        <Styles.Button type="button" onClick={onPickAgain}>
          Pick start
        </Styles.Button>
        <Styles.IconButton type="button" aria-label={replay.playing ? 'Pause' : 'Play'} title={replay.playing ? 'Pause' : 'Play'} onClick={onTogglePlay}>
          {replay.playing ? <PauseIcon /> : <PlayIcon />}
        </Styles.IconButton>
        <Styles.IconButton type="button" aria-label="Step forward" title="Step forward (→)" onClick={onStep}>
          <StepIcon />
        </Styles.IconButton>
        <Styles.Speed aria-label="Replay speed" value={replay.speed} onChange={(event) => onSpeed(Number(event.target.value))}>
          {SPEEDS.map((speed) => (
            <option key={speed} value={speed}>{`${speed}×`}</option>
          ))}
        </Styles.Speed>
        <Styles.Message>{`Replaying ${DAY.format(new Date(`${replay.cutoff}T00:00:00Z`))}`}</Styles.Message>
      </>
    )}
    <Styles.Button type="button" aria-label="Exit replay" title="Exit replay (Esc)" onClick={onExit}>
      Exit
    </Styles.Button>
  </Styles.Bar>
)

import styled, { css, keyframes } from 'styled-components'
import { WATCH_COLUMN_WIDTH } from '../../../shared/limits'

const COLUMNS = 'minmax(0, 1fr) 76px 72px 72px'
const NO_EXTENDED_COLUMNS = 'minmax(0, 1fr) 76px 72px'
const COMPACT_COLUMNS = 'minmax(0, 1fr) 72px'
const NO_EXTENDED_WIDTH = 380
const COMPACT_WIDTH = 300
const GAP = 4

type Extra = { $extra?: number }

const below = (width: number, extra = 0): string => `@container (max-width: ${width + extra * WATCH_COLUMN_WIDTH}px)`

const extraTracks = (extra = 0): string => ` ${WATCH_COLUMN_WIDTH - GAP}px`.repeat(extra)

const columns = css<Extra>`
  grid-template-columns: ${(props) => COLUMNS + extraTracks(props.$extra)};

  ${(props) => below(NO_EXTENDED_WIDTH, props.$extra)} {
    grid-template-columns: ${(props) => NO_EXTENDED_COLUMNS + extraTracks(props.$extra)};
  }

  ${(props) => below(COMPACT_WIDTH, props.$extra)} {
    grid-template-columns: ${(props) => COMPACT_COLUMNS + extraTracks(props.$extra)};
  }
`

const wideOnly = css<Extra>`
  ${(props) => below(COMPACT_WIDTH, props.$extra)} {
    display: none;
  }
`

const widestOnly = css<Extra>`
  ${(props) => below(NO_EXTENDED_WIDTH, props.$extra)} {
    display: none;
  }
`

export const Panel = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  container-type: inline-size;
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 8px 0 14px;
`

export const Title = styled.div`
  font-size: 15px;
  font-weight: 600;
`

export const IconButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  font-size: 20px;
  line-height: 1;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Columns = styled.div<Extra>`
  display: grid;
  ${columns}
  gap: ${GAP}px;
  padding: 6px 30px 6px 14px;
  border-bottom: 1px solid ${(props) => props.theme.ui.separator};
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
`

export const ColumnLabel = styled.button<Extra & { $right?: boolean; $wideOnly?: boolean; $widestOnly?: boolean; $sorted: boolean }>`
  color: ${(props) => (props.$sorted ? props.theme.ui.text : 'inherit')};
  font: inherit;
  text-align: ${(props) => (props.$right ? 'right' : 'left')};
  white-space: nowrap;

  &:hover {
    color: ${(props) => props.theme.ui.text};
  }

  ${(props) => props.$wideOnly && wideOnly}
  ${(props) => props.$widestOnly && widestOnly}
`

export const Rows = styled.ul`
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
`

export const RemoveButton = styled.button`
  position: absolute;
  top: 50%;
  right: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  transform: translateY(-50%);
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 16px;
  line-height: 1;
  opacity: 0;

  &:hover {
    background: ${(props) => props.theme.ui.border};
    color: ${(props) => props.theme.ui.text};
  }

  &:focus-visible {
    opacity: 1;
  }
`

export const Row = styled.li<{ $dragging: boolean }>`
  position: relative;
  border-bottom: 1px solid ${(props) => props.theme.ui.separator};
  opacity: ${(props) => (props.$dragging ? 0.4 : 1)};

  &:hover ${RemoveButton} {
    opacity: 1;
  }
`

export const RowButton = styled.button<Extra>`
  display: grid;
  ${columns}
  gap: ${GAP}px;
  align-items: center;
  width: 100%;
  height: 29px;
  padding: 0 30px 0 14px;
  text-align: left;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }

  &[aria-current='true'] {
    background: ${(props) => props.theme.ui.active};
  }
`

export const Symbol = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`

export const Ticker = styled.div`
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const Number = styled.div<Extra & { $color?: string; $wideOnly?: boolean; $widestOnly?: boolean }>`
  color: ${(props) => props.$color ?? 'inherit'};
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
  ${(props) => props.$wideOnly && wideOnly}
  ${(props) => props.$widestOnly && widestOnly}
`

const flashing = keyframes`
  0%, 70% {
    color: var(--flash);
  }
`

export const FlashPart = styled.span<{ $up: boolean; $ms: number }>`
  --flash: ${(props) => (props.$up ? props.theme.ui.up : props.theme.ui.down)};
  animation: ${flashing} ${(props) => props.$ms}ms linear;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

export const Empty = styled.div`
  padding: 24px 14px;
  color: ${(props) => props.theme.ui.textMuted};
  text-align: center;
`

export const SessionDot = styled.div<{ $session: 'pre' | 'post' }>`
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  margin-left: -3px;
  border-radius: 50%;
  background: ${(props) => (props.$session === 'pre' ? props.theme.ui.preMarket : props.theme.ui.postMarket)};
`

export const EarningsSoon = styled.span`
  flex-shrink: 0;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  color: ${(props) => props.theme.ui.accent};
  border: 1px solid ${(props) => props.theme.ui.accent};
  border-radius: 7px;
`

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`

export const LiveMark = styled.span<{ $live: boolean }>`
  width: 7px;
  height: 7px;
  margin-right: 8px;
  border-radius: 50%;
  background: ${(props) => (props.$live ? props.theme.ui.up : props.theme.ui.textMuted)};
`

export const SectionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 15px;
  line-height: 1;
  opacity: 0;

  &:hover {
    background: ${(props) => props.theme.ui.border};
    color: ${(props) => props.theme.ui.text};
  }

  &:focus-visible {
    opacity: 1;
  }
`

export const Section = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  height: 29px;
  padding: 0 6px 0 14px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
  letter-spacing: 0.04em;
  text-transform: uppercase;

  &:hover ${SectionButton} {
    opacity: 1;
  }
`

export const SectionTitle = styled.div`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const SectionInput = styled.input`
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid ${(props) => props.theme.ui.accent};
  border-radius: 4px;
  background: ${(props) => props.theme.ui.bg};
  color: ${(props) => props.theme.ui.text};
  font-size: 12px;
`

export const Picker = styled.div`
  position: relative;
`

export const ColumnsMenu = styled.div`
  position: absolute;
  top: 32px;
  right: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 200px;
  padding: 6px;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 6px;
  box-shadow: 0 2px 8px ${(props) => props.theme.ui.shadow};
`

export const ColumnsTitle = styled.div`
  padding: 4px 8px 6px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
`

export const ColumnOption = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

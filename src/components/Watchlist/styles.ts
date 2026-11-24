import styled, { css } from 'styled-components'

const COLUMNS = 'minmax(0, 1fr) 76px 72px 72px'
const NO_EXTENDED_COLUMNS = 'minmax(0, 1fr) 76px 72px'
const COMPACT_COLUMNS = 'minmax(0, 1fr) 72px'
const NO_EXTENDED = '@container (max-width: 380px)'
const COMPACT = '@container (max-width: 300px)'

const columns = css`
  grid-template-columns: ${COLUMNS};

  ${NO_EXTENDED} {
    grid-template-columns: ${NO_EXTENDED_COLUMNS};
  }

  ${COMPACT} {
    grid-template-columns: ${COMPACT_COLUMNS};
  }
`

const wideOnly = css`
  ${COMPACT} {
    display: none;
  }
`

const widestOnly = css`
  ${NO_EXTENDED} {
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

export const Columns = styled.div`
  display: grid;
  ${columns}
  gap: 4px;
  padding: 6px 30px 6px 14px;
  border-bottom: 1px solid ${(props) => props.theme.ui.separator};
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
`

export const ColumnLabel = styled.button<{ $right?: boolean; $wideOnly?: boolean; $widestOnly?: boolean; $sorted: boolean }>`
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

export const RowButton = styled.button`
  display: grid;
  ${columns}
  gap: 4px;
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

export const Number = styled.div<{ $color?: string; $wideOnly?: boolean; $widestOnly?: boolean }>`
  color: ${(props) => props.$color ?? 'inherit'};
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
  ${(props) => props.$wideOnly && wideOnly}
  ${(props) => props.$widestOnly && widestOnly}
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

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
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

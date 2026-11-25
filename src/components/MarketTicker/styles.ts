import styled from 'styled-components'

export const TICKER_HEIGHT = 26

export const Strip = styled.section`
  display: flex;
  align-items: center;
  gap: 4px;
  height: 100%;
  padding: 0 6px;
  background: ${(props) => props.theme.ui.panel};
  font-size: 12px;
  overflow: hidden;
`

export const Markets = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`

export const Market = styled.button<{ $active: boolean }>`
  display: inline-flex;
  flex: none;
  align-items: baseline;
  gap: 6px;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.text};
  background: ${(props) => (props.$active ? props.theme.ui.active : 'transparent')};
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Name = styled.span`
  font-weight: 600;
  white-space: nowrap;
`

export const Price = styled.span`
  font-variant-numeric: tabular-nums;
`

export const Change = styled.span<{ $color: string }>`
  color: ${(props) => props.$color};
  font-variant-numeric: tabular-nums;
`

export const Chip = styled.span`
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 4px 0 8px;
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 11px;
  color: ${(props) => props.theme.ui.text};
`

export const Remove = styled.button`
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 13px;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: ${(props) => props.theme.ui.text};
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Action = styled.button<{ $strong?: boolean }>`
  flex: none;
  height: 22px;
  padding: 0 10px;
  border-radius: 4px;
  color: ${(props) => (props.$strong ? props.theme.ui.onAccent : props.theme.ui.text)};
  background: ${(props) => (props.$strong ? props.theme.ui.accent : 'transparent')};
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    background: ${(props) => (props.$strong ? props.theme.ui.accent : props.theme.ui.hover)};
  }
`

export const Edit = styled.button`
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 22px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};
  cursor: pointer;

  &:hover {
    color: ${(props) => props.theme.ui.text};
    background: ${(props) => props.theme.ui.hover};
  }
`

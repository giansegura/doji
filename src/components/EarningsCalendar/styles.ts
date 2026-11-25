import styled from 'styled-components'

export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8vh;
  background: rgba(0, 0, 0, 0.45);
`

export const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  width: 920px;
  max-width: calc(100vw - 32px);
  max-height: 80vh;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 8px;
  box-shadow: 0 8px 28px ${(props) => props.theme.ui.shadow};
  overflow: hidden;

  &:focus {
    outline: none;
  }
`

export const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid ${(props) => props.theme.ui.border};
`

export const Title = styled.div`
  font-size: 16px;
  font-weight: 600;
`

export const Nav = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 6px;
`

export const Range = styled.div`
  min-width: 160px;
  text-align: center;
  font-variant-numeric: tabular-nums;
`

export const NavButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 4px;
  font-size: 18px;
  line-height: 1;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const TextButton = styled.button`
  height: 28px;
  padding: 0 10px;
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Filter = styled.select`
  height: 28px;
  padding: 0 8px;
  color: ${(props) => props.theme.ui.text};
  background: ${(props) => props.theme.ui.panel};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;
`

export const Status = styled.div`
  padding: 8px 16px;
  font-size: 12px;
  color: ${(props) => props.theme.ui.textMuted};
  border-bottom: 1px solid ${(props) => props.theme.ui.border};
`

export const Week = styled.div<{ $days: number }>`
  display: grid;
  grid-template-columns: repeat(${(props) => props.$days}, minmax(0, 1fr));
  min-height: 280px;
  overflow-y: auto;
`

export const Day = styled.div<{ $today: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 6px;
  border-right: 1px solid ${(props) => props.theme.ui.border};
  background: ${(props) => (props.$today ? props.theme.ui.hover : 'transparent')};

  &:last-child {
    border-right: none;
  }
`

export const DayName = styled.div`
  padding: 0 6px 6px;
  font-size: 12px;
  font-weight: 600;
  color: ${(props) => props.theme.ui.textMuted};
`

export const Entry = styled.button<{ $past: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 6px;
  border-radius: 4px;
  text-align: left;
  opacity: ${(props) => (props.$past ? 0.55 : 1)};

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Ticker = styled.span`
  font-weight: 600;
`

export const Mark = styled.span`
  font-size: 13px;
  color: ${(props) => props.theme.ui.textMuted};
`

export const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  font-size: 12px;
  border-top: 1px solid ${(props) => props.theme.ui.border};
`

export const Legend = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
`

export const Check = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
`

export const Weekday = styled.span`
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
`

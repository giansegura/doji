import styled from 'styled-components'

export const Layout = styled.div<{ $listWidth: number }>`
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) min(${(props) => props.$listWidth}px, 60vw);
  grid-template-rows: 38px minmax(0, 1fr);
  grid-template-areas:
    'top top top'
    'tools chart list';
  gap: ${(props) => props.theme.ui.gap}px;
  height: 100%;
  background: ${(props) => props.theme.ui.separator};
`

export const Top = styled.div`
  grid-area: top;
  min-width: 0;
`

export const Tools = styled.div`
  grid-area: tools;
`

export const Chart = styled.main`
  grid-area: chart;
  position: relative;
  min-width: 0;
  min-height: 0;
  background: ${(props) => props.theme.chart.bg};
`

export const Panes = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
`

export const Pane = styled.div<{ $second?: boolean }>`
  position: relative;
  flex: 1;
  min-width: 0;
  border-left: ${(props) => (props.$second ? `${props.theme.ui.gap}px solid ${props.theme.ui.separator}` : 'none')};
`

export const List = styled.aside`
  grid-area: list;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: ${(props) => props.theme.ui.panel};
`

export const Message = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 14px;
`

export const ActionButton = styled.button`
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  background: ${(props) => props.theme.ui.accent};
  color: ${(props) => props.theme.ui.onAccent};
`

export const FullScreen = styled.div`
  position: fixed;
  inset: 0;
`

export const Veil = styled.div`
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => (props.theme.name === 'dark' ? 'rgba(19, 23, 34, 0.6)' : 'rgba(255, 255, 255, 0.6)')};
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 14px;
`

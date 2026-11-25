import styled from 'styled-components'

export const RANGE_BAR_HEIGHT = 28

export const Wrapper = styled.div`
  position: absolute;
  inset: 0;
`

export const Canvas = styled.div`
  position: absolute;
  inset: 0 0 ${RANGE_BAR_HEIGHT}px 0;

  &[data-cursor='pointer'] * {
    cursor: pointer !important;
  }

  &[data-cursor='grabbing'] * {
    cursor: grabbing !important;
  }

  &[data-cursor='crosshair'] * {
    cursor: crosshair !important;
  }
`

export const Legend = styled.div<{ $top: number }>`
  position: absolute;
  top: ${(props) => props.$top}px;
  left: 12px;
  max-width: calc(100% - 190px);
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 2px;
  pointer-events: none;
  font-size: 13px;
  line-height: 20px;
  color: ${(props) => props.theme.ui.text};
`

export const LegendRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
`

export const LegendTitle = styled.div`
  font-size: 14px;
`

export const LegendEarnings = styled.span`
  padding: 1px 6px;
  font-size: 11px;
  color: ${(props) => props.theme.ui.accent};
  border: 1px solid ${(props) => props.theme.ui.accent};
  border-radius: 9px;
  white-space: nowrap;
`

export const LegendLabel = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
`

export const LegendValue = styled.div<{ $color: string }>`
  color: ${(props) => props.$color};
  font-variant-numeric: tabular-nums;
`

export const LegendPair = styled.div`
  display: flex;
  gap: 3px;
`

export const Notice = styled.div`
  position: absolute;
  top: 8px;
  right: 72px;
  z-index: 3;
  padding: 4px 10px;
  border-radius: 4px;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  color: ${(props) => props.theme.ui.textMuted};
`

export const AutoFit = styled.button`
  position: absolute;
  right: 6px;
  bottom: ${RANGE_BAR_HEIGHT + 3}px;
  z-index: 3;
  height: 20px;
  padding: 0 6px;
  border-radius: 4px;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.accent};
  color: ${(props) => props.theme.ui.accent};
  font-size: 11px;
  line-height: 18px;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const Toolbar = styled.div`
  position: absolute;
  top: 56px;
  left: 50%;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 38px;
  padding: 0 8px;
  transform: translateX(-50%);
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 6px;
  box-shadow: 0 2px 8px ${(props) => props.theme.ui.shadow};
`

export const ToolbarDivider = styled.div`
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: ${(props) => props.theme.ui.border};
`

export const Swatch = styled.button<{ $color: string }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${(props) => props.$color};
  border: 2px solid ${(props) => props.theme.ui.popup};
  box-shadow: inset 0 0 0 1px ${(props) => props.theme.ui.border};

  &[aria-pressed='true'] {
    box-shadow:
      0 0 0 2px ${(props) => props.theme.ui.text},
      inset 0 0 0 1px ${(props) => props.theme.ui.border};
  }
`

export const OpacitySlider = styled.input`
  width: 72px;
  accent-color: ${(props) => props.theme.ui.accent};
  cursor: pointer;
`

export const StyleAnchor = styled.div`
  position: relative;
`

export const StylePanel = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  transform: translateX(-50%);
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 6px;
  box-shadow: 0 2px 8px ${(props) => props.theme.ui.shadow};
`

export const StyleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

export const LineText = styled.input<{ $narrow?: boolean }>`
  width: ${(props) => (props.$narrow ? 72 : 110)}px;
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
  color: ${(props) => props.theme.ui.text};
  background: ${(props) => props.theme.ui.panel};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;

  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.ui.accent};
  }
`

export const OpacityValue = styled.span`
  min-width: 32px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: ${(props) => props.theme.ui.textMuted};
`

export const ToolbarButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }

  &[aria-pressed='true'] {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.accent};
  }
`

export const WidthSample = styled.div<{ $width: number }>`
  width: 16px;
  height: ${(props) => props.$width}px;
  border-radius: 2px;
  background: currentColor;
`


export const RangeBar = styled.div`
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  height: ${RANGE_BAR_HEIGHT}px;
  padding: 0 8px;
  border-top: 1px solid ${(props) => props.theme.ui.separator};
  font-size: 12px;
`

export const RangeButton = styled.button`
  height: 22px;
  padding: 0 7px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};

  &:hover {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.text};
  }
`

export const RangeDivider = styled.div`
  width: 1px;
  height: 16px;
  margin: 0 6px;
  background: ${(props) => props.theme.ui.separator};
`

export const GoTo = styled.form`
  display: flex;
`

export const GoToField = styled.input`
  height: 22px;
  padding: 0 6px;
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;
  background: transparent;
  color: ${(props) => props.theme.ui.textMuted};
  font: inherit;
  color-scheme: ${(props) => (props.theme.name === 'light' ? 'light' : 'dark')};
`

export const AlertRepeat = styled.select`
  height: 26px;
  padding: 0 4px;
  font-size: 12px;
  color: ${(props) => props.theme.ui.text};
  background: ${(props) => props.theme.ui.panel};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;
`

export const AlertUntil = styled.input`
  width: 122px;
  height: 26px;
  padding: 0 6px;
  font: inherit;
  font-size: 12px;
  color: ${(props) => props.theme.ui.text};
  background: ${(props) => props.theme.ui.panel};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;
  color-scheme: ${(props) => (props.theme.name === 'light' ? 'light' : 'dark')};
`

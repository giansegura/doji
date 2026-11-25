import styled from 'styled-components'

export const Bar = styled.header`
  display: flex;
  align-items: center;
  gap: 4px;
  height: 100%;
  padding: 0 8px;
  background: ${(props) => props.theme.ui.panel};
`

export const Button = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  min-width: 30px;
  padding: 0 8px;
  justify-content: center;
  border-radius: 4px;
  font-size: 14px;
  color: ${(props) => (props.$active ? props.theme.ui.accent : props.theme.ui.text)};

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const SymbolButton = styled(Button)`
  font-weight: 600;
  padding: 0 10px;
`

export const Divider = styled.div`
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: ${(props) => props.theme.ui.border};
`

export const Spacer = styled.div`
  flex: 1;
`

export const Warning = styled.div`
  padding: 0 8px;
  color: ${(props) => props.theme.ui.down};
`

export const MenuAnchor = styled.div`
  position: relative;
`

export const Menu = styled.div<{ $right?: boolean }>`
  position: absolute;
  top: 34px;
  ${(props) => (props.$right ? 'right: 0;' : 'left: 0;')}
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 210px;
  max-height: calc(100vh - 56px);
  overflow-y: auto;
  padding: 6px;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 6px;
  box-shadow: 0 2px 8px ${(props) => props.theme.ui.shadow};
`

export const MenuRow = styled.label<{ $indented?: boolean }>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 8px 0 ${(props) => (props.$indented ? 28 : 8)}px;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }

  input[type='checkbox'] {
    accent-color: ${(props) => props.theme.ui.accent};
  }
`

export const RowLabel = styled.div`
  flex: 1;
`

export const NumberInput = styled.input`
  width: 56px;
  height: 24px;
  padding: 0 6px;
  background: ${(props) => props.theme.ui.bg};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;
`

export const MenuItem = styled.div<{ $indented?: boolean }>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  padding: 0 8px 0 ${(props) => (props.$indented ? 28 : 8)}px;
`

export const Menus = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

export const ThemeOption = styled.button`
  display: flex;
  align-items: center;
  gap: 10px;
  height: 32px;
  padding: 0 8px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.text};
  text-align: left;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }

  &[aria-checked='true'] {
    color: ${(props) => props.theme.ui.accent};
  }
`

export const ThemeSwatch = styled.span<{ $panel: string; $chart: string; $accent: string }>`
  display: flex;
  flex-shrink: 0;
  overflow: hidden;
  width: 30px;
  height: 18px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1px ${(props) => props.theme.ui.border};
  background: linear-gradient(
    90deg,
    ${(props) => props.$panel} 0 33%,
    ${(props) => props.$chart} 33% 66%,
    ${(props) => props.$accent} 66% 100%
  );
`

export const Brand = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  margin: 0 6px 0 2px;
`

export const MenuSection = styled.div<{ $first?: boolean }>`
  margin-top: ${(props) => (props.$first ? 0 : 4)}px;
  padding: ${(props) => (props.$first ? 4 : 8)}px 8px 4px;
  border-top: ${(props) => (props.$first ? 'none' : `1px solid ${props.theme.ui.border}`)};
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
`

export const ColorDot = styled.button<{ $color: string }>`
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${(props) => props.$color};
`

export const SmallButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 16px;
  line-height: 1;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.text};
  }
`

export const AddButton = styled.button`
  height: 30px;
  margin-top: 2px;
  padding: 0 8px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.accent};
  text-align: left;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }

  &:disabled {
    color: ${(props) => props.theme.ui.textMuted};
    cursor: default;
  }
`

export const SmaBlock = styled.div`
  display: flex;
  flex-direction: column;
`

export const StylePanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 2px 8px 6px;
  padding: 8px;
  background: ${(props) => props.theme.ui.bg};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 6px;
`

export const Swatches = styled.div`
  display: grid;
  grid-template-columns: repeat(9, 18px);
  gap: 6px;
  align-items: center;
`

export const Swatch = styled.button<{ $color: string }>`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${(props) => props.$color};
  border: 1px solid ${(props) => props.theme.ui.border};

  &[aria-pressed='true'] {
    box-shadow: 0 0 0 2px ${(props) => props.theme.ui.accent};
  }
`

export const ColorInput = styled.input`
  width: 18px;
  height: 18px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
`

export const Widths = styled.div`
  display: flex;
  gap: 4px;
`

export const WidthButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 24px;
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
  width: 20px;
  height: ${(props) => props.$width}px;
  border-radius: 2px;
  background: currentColor;
`

export const MenuAction = styled.button`
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  text-align: left;
  white-space: nowrap;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const HiddenInput = styled.input`
  display: none;
`

export const MenuNote = styled.div<{ $danger?: boolean }>`
  max-width: 250px;
  padding: 6px 8px;
  color: ${(props) => (props.$danger ? props.theme.ui.down : props.theme.ui.text)};
  line-height: 1.4;
  overflow-wrap: anywhere;
`

export const ConfirmBox = styled.div`
  margin-top: 4px;
  border-top: 1px solid ${(props) => props.theme.ui.border};
`

export const ConfirmActions = styled.div`
  display: flex;
  gap: 4px;
  padding: 0 0 2px;
`

export const TextButton = styled.button<{ $danger?: boolean }>`
  height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  color: ${(props) => (props.$danger ? props.theme.ui.down : props.theme.ui.textMuted)};

  &:hover {
    background: ${(props) => props.theme.ui.hover};
  }
`

export const TypeButton = styled.button`
  flex: 1;
  height: 24px;
  padding: 0 6px;
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 11px;
  text-align: center;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.text};
  }
`

export const TelegramForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0 12px 8px;
`

export const TokenInput = styled.input`
  height: 28px;
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

export const Count = styled.span`
  min-width: 14px;
  height: 14px;
  margin-left: -6px;
  margin-top: -10px;
  padding: 0 3px;
  border-radius: 7px;
  background: ${(props) => props.theme.ui.accent};
  color: ${(props) => props.theme.ui.onAccent};
  font-size: 9px;
  line-height: 14px;
  text-align: center;
`

import styled from 'styled-components'

export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 12vh 0 24px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.45);
`

export const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 520px;
  max-width: calc(100vw - 32px);
  padding: 16px;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 8px;
  box-shadow: 0 8px 28px ${(props) => props.theme.ui.shadow};
`

export const Title = styled.div`
  font-size: 16px;
  font-weight: 600;
`

export const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 12px;
`

const control = `
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  font-size: 13px;
`

export const Input = styled.input`
  ${control}
  color: ${(props) => props.theme.ui.text};
  background: ${(props) => props.theme.ui.panel};
  border: 1px solid ${(props) => props.theme.ui.border};
`

export const Select = styled.select`
  ${control}
  color: ${(props) => props.theme.ui.text};
  background: ${(props) => props.theme.ui.panel};
  border: 1px solid ${(props) => props.theme.ui.border};
`

export const Scope = styled.div`
  display: flex;
  gap: 16px;
`

export const Radio = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
`

export const Conditions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

export const Condition = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px 90px 28px;
  gap: 8px;
  align-items: center;
`

export const IconButton = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 4px;
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 18px;
  line-height: 1;

  &:hover {
    background: ${(props) => props.theme.ui.hover};
    color: ${(props) => props.theme.ui.text};
  }
`

export const Footer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

export const Spacer = styled.div`
  flex: 1;
`

export const Button = styled.button<{ $primary?: boolean; $danger?: boolean }>`
  height: 30px;
  padding: 0 12px;
  border-radius: 4px;
  border: 1px solid ${(props) => (props.$primary ? props.theme.ui.accent : props.theme.ui.border)};
  background: ${(props) => (props.$primary ? props.theme.ui.accent : 'transparent')};
  color: ${(props) => (props.$primary ? props.theme.ui.onAccent : props.$danger ? props.theme.ui.down : props.theme.ui.text)};

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }
`

export const Link = styled.button`
  align-self: flex-start;
  color: ${(props) => props.theme.ui.accent};

  &:hover {
    text-decoration: underline;
  }
`

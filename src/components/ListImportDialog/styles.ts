import styled from 'styled-components'

export const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 16vh;
  background: rgba(0, 0, 0, 0.45);
`

export const Dialog = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 440px;
  max-width: calc(100vw - 32px);
  padding: 16px;
  background: ${(props) => props.theme.ui.popup};
  border: 1px solid ${(props) => props.theme.ui.border};
  border-radius: 8px;
  box-shadow: 0 8px 28px ${(props) => props.theme.ui.shadow};

  &:focus {
    outline: none;
  }
`

export const Title = styled.div`
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
`

export const Text = styled.p`
  margin: 0;
  color: ${(props) => props.theme.ui.text};
  font-size: 13px;
  line-height: 1.45;
`

export const Track = styled.div`
  height: 4px;
  border-radius: 2px;
  background: ${(props) => props.theme.ui.border};
  overflow: hidden;
`

export const Fill = styled.div.attrs<{ $share: number }>((props) => ({ style: { width: `${Math.round(props.$share * 100)}%` } }))<{
  $share: number
}>`
  height: 100%;
  background: ${(props) => props.theme.ui.accent};
  transition: width 0.2s ease;
`

export const Missing = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 160px;
  overflow-y: auto;
  font-size: 12px;
`

export const MissingTitle = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
`

export const MissingList = styled.div`
  color: ${(props) => props.theme.ui.text};
  overflow-wrap: anywhere;
`

export const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
`

export const Button = styled.button`
  height: 30px;
  padding: 0 14px;
  border-radius: 6px;
  background: ${(props) => props.theme.ui.accent};
  color: ${(props) => props.theme.ui.onAccent};
`

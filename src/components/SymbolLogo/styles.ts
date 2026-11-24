import styled from 'styled-components'

export const Badge = styled.div<{ $size: number }>`
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  overflow: hidden;
  border-radius: 50%;
  background: ${(props) => props.theme.ui.border};
  color: ${(props) => props.theme.ui.textMuted};
  font-size: ${(props) => Math.round(props.$size * 0.55)}px;
  font-weight: 600;
  line-height: 1;
`

export const Image = styled.img`
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 16%;
  object-fit: contain;
  background: #ffffff;
  opacity: 0;

  &[data-loaded='true'] {
    opacity: 1;
  }
`

export const Pair = styled.div<{ $size: number }>`
  position: relative;
  flex-shrink: 0;
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
`

export const Flag = styled.div<{ $size: number; $front: boolean }>`
  position: absolute;
  ${(props) => (props.$front ? 'left: 0; bottom: 0; z-index: 1;' : 'right: 0; top: 0;')}
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${(props) => props.$size}px;
  height: ${(props) => props.$size}px;
  overflow: hidden;
  border-radius: 50%;
  background: ${(props) => props.theme.ui.border};
  box-shadow: ${(props) => (props.$front ? `0 0 0 1.5px ${props.theme.ui.panel}` : 'none')};
  color: ${(props) => props.theme.ui.textMuted};
  font-size: ${(props) => Math.round(props.$size * 0.55)}px;
  font-weight: 600;
  line-height: 1;
`

export const Emoji = styled.span<{ $size: number }>`
  font-size: ${(props) => Math.round(props.$size * 1.45)}px;
  line-height: 1;
`

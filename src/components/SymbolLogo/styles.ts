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
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #ffffff;
  opacity: 0;

  &[data-loaded='true'] {
    opacity: 1;
  }
`

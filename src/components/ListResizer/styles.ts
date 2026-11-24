import styled from 'styled-components'

export const Handle = styled.div<{ $active: boolean }>`
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  z-index: 5;
  width: 8px;
  cursor: col-resize;
  touch-action: none;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 3px;
    width: 2px;
    background: ${(props) => (props.$active ? props.theme.ui.accent : 'transparent')};
  }

  &:hover::after,
  &:focus-visible::after {
    background: ${(props) => props.theme.ui.accent};
  }

  &:focus-visible {
    outline: none;
  }
`

export const Shield = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  cursor: col-resize;
`

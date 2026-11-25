import styled from 'styled-components'

export const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 280px;
  padding: 4px 4px 6px;
  font-size: 13px;
`

export const Title = styled.div`
  font-weight: 600;
`

export const Note = styled.div`
  color: ${(props) => props.theme.ui.textMuted};
  font-size: 12px;
`

export const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
`

export const Item = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
`

export const ItemLabel = styled.label`
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`

export const Remove = styled.button`
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

export const Form = styled.form`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid ${(props) => props.theme.ui.separator};
`

const control = `
  height: 26px;
  padding: 0 6px;
  border-radius: 4px;
  font: inherit;
`

export const Select = styled.select`
  ${control}
  flex: 1;
  min-width: 0;
  color: ${(props) => props.theme.ui.text};
  background: ${(props) => props.theme.ui.panel};
  border: 1px solid ${(props) => props.theme.ui.border};
`

export const Input = styled.input`
  ${control}
  width: 64px;
  color: ${(props) => props.theme.ui.text};
  background: ${(props) => props.theme.ui.panel};
  border: 1px solid ${(props) => props.theme.ui.border};
`

export const Add = styled.button`
  ${control}
  color: ${(props) => props.theme.ui.onAccent};
  background: ${(props) => props.theme.ui.accent};

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`

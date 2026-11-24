import { type ChangeEvent, useRef, useState } from 'react'
import type { AppState } from '../../../shared/types'
import { parseConfig } from '../../domain/configFile'
import * as Styles from './styles'

type ConfigPanelProps = {
  onExport: () => void
  onImport: (config: AppState) => void
}

type Step =
  | { kind: 'idle' }
  | { kind: 'invalid' }
  | { kind: 'confirm'; config: AppState; fileName: string }
  | { kind: 'done' }

const IDLE: Step = { kind: 'idle' }

const readText = (file: File): Promise<string> => file.text().catch(() => '')

export const ConfigPanel = ({ onExport, onImport }: ConfigPanelProps) => {
  const [step, setStep] = useState<Step>(IDLE)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const config = parseConfig(await readText(file))
    setStep(config ? { kind: 'confirm', config, fileName: file.name } : { kind: 'invalid' })
  }

  const handleConfirm = () => {
    if (step.kind !== 'confirm') return
    onImport(step.config)
    setStep({ kind: 'done' })
  }

  return (
    <>
      <Styles.MenuAction type="button" onClick={onExport}>
        Exportar configuración
      </Styles.MenuAction>
      <Styles.MenuAction type="button" onClick={() => inputRef.current?.click()}>
        Importar configuración…
      </Styles.MenuAction>
      <Styles.HiddenInput
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        aria-label="Archivo de configuración"
        onChange={handleFile}
      />
      {step.kind === 'invalid' && (
        <Styles.MenuNote role="alert" $danger>
          Ese archivo no es una configuración de doji.
        </Styles.MenuNote>
      )}
      {step.kind === 'confirm' && (
        <Styles.ConfirmBox>
          <Styles.MenuNote>{`Se reemplazarán tus listas, líneas, indicadores y ajustes por los de «${step.fileName}».`}</Styles.MenuNote>
          <Styles.ConfirmActions>
            <Styles.TextButton type="button" $danger onClick={handleConfirm}>
              Reemplazar
            </Styles.TextButton>
            <Styles.TextButton type="button" onClick={() => setStep(IDLE)}>
              Cancelar
            </Styles.TextButton>
          </Styles.ConfirmActions>
        </Styles.ConfirmBox>
      )}
      {step.kind === 'done' && <Styles.MenuNote role="status">Configuración importada.</Styles.MenuNote>}
    </>
  )
}

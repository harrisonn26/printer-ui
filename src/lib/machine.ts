import type { KlippyState, SessionStatus } from './moonraker/session.svelte'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export interface MachineState {
  label: string
  tone: Tone
  busy: boolean
}

type PrintState = Klipper.PrintStatsState['state']

const PRINT: Record<PrintState, MachineState> = {
  standby: { label: 'Idle', tone: 'neutral', busy: false },
  printing: { label: 'Printing', tone: 'accent', busy: true },
  paused: { label: 'Paused', tone: 'warning', busy: false },
  complete: { label: 'Complete', tone: 'success', busy: false },
  cancelled: { label: 'Cancelled', tone: 'neutral', busy: false },
  error: { label: 'Error', tone: 'danger', busy: false }
}

const KLIPPY: Record<Exclude<KlippyState, 'ready'>, MachineState> = {
  unknown: { label: 'Checking', tone: 'neutral', busy: true },
  startup: { label: 'Starting', tone: 'accent', busy: true },
  disconnected: { label: 'Klipper offline', tone: 'danger', busy: false },
  error: { label: 'Klipper error', tone: 'danger', busy: false },
  shutdown: { label: 'Shutdown', tone: 'danger', busy: false }
}

/** One label for what the machine is doing: connection, then Klipper, then the print. */
export const machineState = (
  status: SessionStatus,
  klippy: KlippyState,
  print: PrintState | undefined
): MachineState => {
  if (status !== 'ready') return { label: 'Offline', tone: 'danger', busy: false }
  if (klippy !== 'ready') return KLIPPY[klippy]
  return PRINT[print ?? 'standby']
}

/**
 * The browser tab title: progress first, so it survives a narrow tab.
 * `56% · main-body — debian`, `Paused 56% · …`, `Idle — debian`.
 */
export const tabTitle = (input: {
  host: string
  state: MachineState
  printState: PrintState | undefined
  progress: number
  job: string
}): string => {
  const percent = `${Math.floor(input.progress * 100)}%`
  let lead: string
  if (input.printState === 'printing' && input.state.label === 'Printing') {
    lead = `${percent} · ${input.job}`
  } else if (input.printState === 'paused' && input.state.label === 'Paused') {
    lead = `Paused ${percent} · ${input.job}`
  } else if (input.job && (input.printState === 'complete' || input.printState === 'cancelled' || input.printState === 'error')) {
    lead = `${input.state.label} · ${input.job}`
  } else {
    lead = input.state.label
  }
  return `${lead} — ${input.host}`
}

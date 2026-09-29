import { machineState, tabTitle } from '../machine'

const title = (printState: Parameters<typeof machineState>[2], progress = 0.564, job = 'main-body', status: 'ready' | 'connecting' = 'ready') => tabTitle({
  host: 'debian',
  state: machineState(status, 'ready', printState),
  printState,
  progress,
  job
})

describe('tabTitle', () => {
  it('leads with progress while printing', () => {
    expect(title('printing')).toBe('56% · main-body — debian')
  })

  it('marks a paused print', () => {
    expect(title('paused')).toBe('Paused 56% · main-body — debian')
  })

  it('names the finished job', () => {
    expect(title('complete', 1)).toBe('Complete · main-body — debian')
    expect(title('cancelled')).toBe('Cancelled · main-body — debian')
  })

  it('shows the machine state otherwise', () => {
    expect(title('standby', 0, '')).toBe('Idle — debian')
    expect(title('printing', 0.5, 'x', 'connecting')).toBe('Offline — debian')
  })
})

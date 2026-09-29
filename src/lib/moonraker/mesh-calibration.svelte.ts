// A bed mesh calibration started from this UI. Kept outside the card so
// the progress survives switching pages mid-probe.

class MeshCalibration {
  /** Console entries after this id belong to the run; null when idle. */
  after = $state<number | null>(null)
  error = $state<string | null>(null)
  /** The probed_matrix Klipper had at the start; a new one means the run finished. */
  baseline: unknown = null

  active = $derived(this.after != null)

  start (lastConsoleId: number, baseline: unknown): void {
    this.after = lastConsoleId
    this.baseline = baseline
    this.error = null
  }

  finish (error: string | null = null): void {
    this.after = null
    this.baseline = null
    this.error = error
  }
}

export const meshCalibration = new MeshCalibration()

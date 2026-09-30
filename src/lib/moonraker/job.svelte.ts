import { session } from './session.svelte'

type Metadata = Pick<
  Moonraker.Files.Metadata,
  'estimated_time' | 'layer_height' | 'first_layer_height' | 'object_height' | 'filament_type' | 'thumbnails' | 'layer_count'
>

/**
 * The current job, derived from print_stats plus the file's metadata, which
 * is fetched once per filename. Metadata is optional: everything degrades to
 * what print_stats alone provides.
 */
class Job {
  metadata = $state.raw<Metadata | null>(null)
  #metadataFor = ''

  stats = $derived(session.printer.get('print_stats'))
  filename = $derived(this.stats?.filename ?? '')
  state = $derived(this.stats?.state ?? 'standby')
  active = $derived(this.state === 'printing' || this.state === 'paused')

  progress = $derived.by(() => {
    const display = session.printer.get('display_status')
    const sdcard = session.printer.get('virtual_sdcard')
    return display?.progress ?? sdcard?.progress ?? 0
  })

  elapsed = $derived(this.stats?.print_duration ?? 0)

  /** Seconds left: the slicer's estimate when we have one, else extrapolated. */
  remaining = $derived.by(() => {
    if (!this.active) return null
    const estimate = this.metadata?.estimated_time
    if (estimate && estimate > 0) return Math.max(estimate - this.elapsed, 0)
    if (this.progress > 0.01 && this.elapsed > 0) return this.elapsed * (1 / this.progress - 1)
    return null
  })

  /** Call from a component effect: fetches metadata when the file changes. */
  syncMetadata (): void {
    const file = this.filename
    if (file === this.#metadataFor) return
    this.#metadataFor = file
    this.metadata = null
    if (!file) return

    session.call<Moonraker.Files.Metadata>('server.files.metadata', { filename: file })
      .then(metadata => {
        if (this.#metadataFor === file) this.metadata = metadata
      })
      .catch(() => {
        // Not every file has metadata; the panel falls back to print_stats.
      })
  }
}

export const job = new Job()

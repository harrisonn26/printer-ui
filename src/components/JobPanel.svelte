<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { formatDuration, jobTitle } from '../lib/format'
  import { machineState } from '../lib/machine'
  import Button from '../lib/ui/Button.svelte'
  import Pill from '../lib/ui/Pill.svelte'
  import ProgressRing from '../lib/ui/ProgressRing.svelte'

  const CONFIRM_MS = 4000

  let pending = $state<string | null>(null)
  let confirmingCancel = $state(false)
  let confirmTimer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    void job.filename
    job.syncMetadata()
  })

  $effect(() => () => clearTimeout(confirmTimer))

  const machine = $derived(machineState(session.status, session.klippy.state, job.state))
  const gcodeMove = $derived(session.printer.get('gcode_move'))
  const z = $derived(gcodeMove?.gcode_position?.[2])
  const showProgress = $derived(job.active || job.state === 'complete')
  const layer = $derived.by(() => {
    const info = job.stats?.info
    return info?.current_layer != null && info.total_layer != null
      ? `${info.current_layer} / ${info.total_layer}`
      : null
  })

  const percent = (factor: number | undefined) => (factor == null ? '—' : `${Math.round(factor * 100)}%`)

  const run = async (method: string) => {
    pending = method
    await session.run(method)
    pending = null
  }

  const cancel = () => {
    if (!confirmingCancel) {
      confirmingCancel = true
      confirmTimer = setTimeout(() => { confirmingCancel = false }, CONFIRM_MS)
      return
    }
    clearTimeout(confirmTimer)
    confirmingCancel = false
    void run('printer.print.cancel')
  }
</script>

<section class="job">
  <!-- The stage becomes the layer preview (phase 5); until then it carries progress. -->
  <div class="stage">
    {#if showProgress}
      <ProgressRing value={job.progress} size={220} label="{Math.round(job.progress * 100)} percent complete">
        <span class="percent num">{Math.floor(job.progress * 100)}%</span>
        {#if job.remaining != null}
          <span class="muted remaining">{formatDuration(job.remaining)} left</span>
        {/if}
      </ProgressRing>
      {#if z != null && job.active}
        <span class="stage-label num">Z {z.toFixed(2)}</span>
      {/if}
    {:else}
      <div class="idle">
        <p class="idle-title">Ready for a print</p>
        <p class="muted">Send one from OrcaSlicer and it appears here.</p>
      </div>
    {/if}
  </div>

  <div class="details">
    <Pill tone={machine.tone} pulse={machine.busy}>{machine.label}</Pill>

    {#if job.filename}
      <h1 title={job.filename}>{jobTitle(job.filename)}</h1>
    {:else}
      <h1 class="none">No job loaded</h1>
    {/if}

    {#if showProgress}
      <dl>
        <div><dt>Elapsed</dt><dd class="num">{formatDuration(job.elapsed)}</dd></div>
        <div><dt>Filament</dt><dd class="num">{((job.stats?.filament_used ?? 0) / 1000).toFixed(2)} m</dd></div>
        <div><dt>Speed</dt><dd class="num">{percent(gcodeMove?.speed_factor)}</dd></div>
        <div><dt>Flow</dt><dd class="num">{percent(gcodeMove?.extrude_factor)}</dd></div>
        {#if layer}<div><dt>Layer</dt><dd class="num">{layer}</dd></div>{/if}
        {#if job.metadata?.filament_type}<div><dt>Material</dt><dd>{job.metadata.filament_type}</dd></div>{/if}
      </dl>
    {/if}

    {#if job.active}
      <div class="actions">
        {#if job.state === 'paused'}
          <Button
            variant="primary"
            loading={pending === 'printer.print.resume'}
            disabled={!session.klippyReady}
            onclick={() => run('printer.print.resume')}
          >Resume</Button>
        {:else}
          <Button
            loading={pending === 'printer.print.pause'}
            disabled={!session.klippyReady}
            onclick={() => run('printer.print.pause')}
          >Pause</Button>
        {/if}
        <Button
          variant={confirmingCancel ? 'danger' : 'secondary'}
          loading={pending === 'printer.print.cancel'}
          disabled={!session.klippyReady}
          onclick={cancel}
        >{confirmingCancel ? 'Confirm cancel' : 'Cancel'}</Button>
      </div>
    {/if}
  </div>
</section>

<style>
  .job {
    display: flex;
    min-height: 480px;
    background: var(--surface);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .stage {
    position: relative;
    flex: 1;
    min-width: 0;
    display: grid;
    place-items: center;
    padding: var(--space-6);
    background: var(--surface-inset);
  }
  .stage-label { position: absolute; left: var(--space-5); top: var(--space-5); font-size: var(--text-xs); color: var(--text-muted); }
  .percent { font-size: var(--text-2xl); font-weight: 600; line-height: 1; }
  .remaining { margin-top: var(--space-1); font-size: var(--text-sm); }
  .idle { text-align: center; }
  .idle p { margin: 0; }
  .idle-title { font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-1) !important; }

  .details {
    width: 300px;
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding: var(--space-6);
    border-left: 1px solid var(--border);
  }
  h1 { margin: 0; font-size: var(--text-xl); font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
  h1.none { color: var(--text-muted); font-weight: 600; }
  dl { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
  dt { font-size: var(--text-xs); color: var(--text-muted); }
  dd { margin: 0; font-size: var(--text-lg); }
  .actions { margin-top: auto; display: flex; gap: var(--space-2); }
  .actions :global(.btn) { flex: 1; }

  @media (max-width: 760px) {
    .job { flex-direction: column; min-height: 0; }
    .stage { height: 250px; flex: none; padding: var(--space-4); }
    .details { width: auto; border-left: 0; padding: var(--space-4) 18px 18px; gap: var(--space-3); }
    h1 { font-size: var(--text-lg); }
    dl { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }
    dd { font-size: var(--text-md); }
    .actions { margin-top: var(--space-1); }
  }
</style>

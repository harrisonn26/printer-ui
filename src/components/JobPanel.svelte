<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { formatDuration, jobTitle } from '../lib/format'
  import { machineState } from '../lib/machine'
  import Button from '../lib/ui/Button.svelte'
  import Pill from '../lib/ui/Pill.svelte'
  import ProgressRing from '../lib/ui/ProgressRing.svelte'
  import Segmented from '../lib/ui/Segmented.svelte'
  import Thumbnail from '../lib/ui/Thumbnail.svelte'
  import CameraView from './CameraView.svelte'
  import LayerPreview from './LayerPreview.svelte'
  import { browserTokenStore } from '../lib/moonraker/tokens'

  const CONFIRM_MS = 4000
  const VIEW_KEY = 'printer-ui:stage-view'

  type StageView = 'layer' | 'camera'
  const VIEWS = [
    { value: 'layer', label: 'Layer' },
    { value: 'camera', label: 'Camera' }
  ] as const

  let view = $state<StageView>(browserTokenStore.get(VIEW_KEY) === 'camera' ? 'camera' : 'layer')
  let cameraIndex = $state(0)

  $effect(() => { browserTokenStore.set(VIEW_KEY, view) })

  const cameras = $derived(session.webcams)
  const camera = $derived(cameras[cameraIndex] ?? cameras[0])
  const showCamera = $derived(view === 'camera' && camera != null)

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
  const showProgress = $derived(job.active || job.state === 'complete')

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
  <div class="stage">
    {#if showCamera && camera}
      <CameraView {camera} />
    {:else if job.filename}
      <LayerPreview />
    {:else}
      <div class="idle">
        {#if session.klippyReady}
          <p class="idle-title">Ready for a print</p>
          <p class="muted">Send one from OrcaSlicer and it appears here.</p>
        {:else}
          <p class="idle-title">Printer not ready</p>
          <p class="muted">Klipper needs attention before it can print.</p>
        {/if}
      </div>
    {/if}

    {#if cameras.length > 0}
      <div class="stage-switch">
        {#if showCamera && cameras.length > 1}
          <select bind:value={cameraIndex} aria-label="Camera">
            {#each cameras as option, index (option.uid)}
              <option value={index}>{option.name ?? `Camera ${index + 1}`}</option>
            {/each}
          </select>
        {/if}
        <Segmented options={VIEWS} bind:value={view} label="Stage view" />
      </div>
    {/if}
  </div>

  <div class="details">
    <Pill tone={machine.tone} pulse={machine.busy}>{machine.label}</Pill>

    {#if job.filename}
      <div class="title-row">
        {#if job.metadata?.thumbnails?.length}
          <Thumbnail path={job.filename} thumbnails={job.metadata.thumbnails} size={64} />
        {/if}
        <h1 title={job.filename}>{jobTitle(job.filename)}</h1>
      </div>
    {:else}
      <h1 class="none">No job loaded</h1>
    {/if}

    {#if showProgress}
      <div class="ring">
        <ProgressRing value={job.progress} size={160} label="{Math.round(job.progress * 100)} percent complete">
          <span class="percent num">{Math.floor(job.progress * 100)}%</span>
          {#if job.remaining != null}
            <span class="muted remaining">{formatDuration(job.remaining)} left</span>
          {/if}
        </ProgressRing>
      </div>

      <div class="bar-row" aria-hidden="true">
        <span class="num">{Math.floor(job.progress * 100)}%</span>
        <div class="bar"><div class="fill" style:width="{job.progress * 100}%"></div></div>
        {#if job.remaining != null}<span class="num muted">{formatDuration(job.remaining)} left</span>{/if}
      </div>

      <dl>
        <div><dt>Elapsed</dt><dd class="num">{formatDuration(job.elapsed)}</dd></div>
        <div><dt>Filament</dt><dd class="num">{((job.stats?.filament_used ?? 0) / 1000).toFixed(2)} m</dd></div>
        <div><dt>Speed</dt><dd class="num">{percent(gcodeMove?.speed_factor)}</dd></div>
        <div><dt>Flow</dt><dd class="num">{percent(gcodeMove?.extrude_factor)}</dd></div>
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
    min-height: 520px;
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
    background: var(--surface-inset);
  }
  .stage-switch {
    position: absolute;
    right: var(--space-4);
    bottom: var(--space-4);
    display: flex;
    gap: var(--space-2);
    z-index: 1;
  }
  .stage-switch select {
    height: 42px;
    padding: 0 var(--space-3);
    border: 0;
    border-radius: 10px;
    background: var(--surface-inset);
    font-size: var(--text-sm);
  }
  .idle { text-align: center; padding: var(--space-6); }
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
  .title-row { display: flex; align-items: center; gap: var(--space-3); }
  h1 { margin: 0; font-size: var(--text-xl); font-weight: 700; line-height: 1.2; overflow-wrap: anywhere; }
  h1.none { color: var(--text-muted); font-weight: 600; }
  .ring { align-self: center; }
  .percent { font-size: 2rem; font-weight: 600; line-height: 1; }
  .remaining { margin-top: var(--space-1); font-size: var(--text-xs); }
  dl { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
  dt { font-size: var(--text-xs); color: var(--text-muted); }
  dd { margin: 0; font-size: var(--text-lg); }
  .actions { margin-top: auto; display: flex; gap: var(--space-2); }
  .actions :global(.btn) { flex: 1; }

  .bar-row { display: none; align-items: center; gap: var(--space-3); font-size: var(--text-sm); }
  .bar { flex: 1; height: 6px; border-radius: 999px; background: var(--control); overflow: hidden; }
  .fill { height: 100%; border-radius: inherit; background: var(--accent); transition: width 400ms ease; }

  @media (max-width: 760px) {
    .bar-row { display: flex; }
    .job { flex-direction: column; min-height: 0; }
    .stage { height: 260px; flex: none; }
    .details { width: auto; border-left: 0; padding: var(--space-4) 18px 18px; gap: var(--space-3); }
    h1 { font-size: var(--text-lg); }
    .ring { display: none; }
    dl { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }
    dd { font-size: var(--text-md); }
    .actions { margin-top: var(--space-1); }
  }
</style>

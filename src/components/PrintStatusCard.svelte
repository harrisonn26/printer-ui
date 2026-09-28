<script lang="ts">
  import { mdiPrinter3dNozzle } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { fileBasename, formatDuration } from '../lib/format'
  import { machineState } from '../lib/machine'
  import Card from '../lib/ui/Card.svelte'
  import Pill from '../lib/ui/Pill.svelte'

  const stats = $derived(session.printer.get('print_stats'))
  const sdcard = $derived(session.printer.get('virtual_sdcard'))
  const display = $derived(session.printer.get('display_status'))

  const machine = $derived(machineState(session.status, session.klippy.state, stats?.state))
  const active = $derived(stats?.state === 'printing' || stats?.state === 'paused')
  const progress = $derived(display?.progress ?? sdcard?.progress ?? 0)
  const layer = $derived(stats?.info?.current_layer != null && stats.info.total_layer != null
    ? `${stats.info.current_layer} / ${stats.info.total_layer}`
    : null)
</script>

<Card title="Print" icon={mdiPrinter3dNozzle}>
  <div class="head">
    <Pill tone={machine.tone} pulse={machine.busy}>{machine.label}</Pill>
    {#if display?.message}<span class="message muted">{display.message}</span>{/if}
  </div>

  {#if stats?.filename}
    <p class="file" title={stats.filename}>{fileBasename(stats.filename)}</p>
  {:else}
    <p class="file empty">No job loaded — send one from the slicer.</p>
  {/if}

  {#if active || stats?.state === 'complete'}
    <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
      <div class="fill" style:width="{progress * 100}%"></div>
    </div>
    <dl>
      <div><dt>Progress</dt><dd class="num">{(progress * 100).toFixed(1)}%</dd></div>
      <div><dt>Elapsed</dt><dd class="num">{formatDuration(stats?.print_duration)}</dd></div>
      {#if layer}<div><dt>Layer</dt><dd class="num">{layer}</dd></div>{/if}
      <div><dt>Filament</dt><dd class="num">{((stats?.filament_used ?? 0) / 1000).toFixed(2)} m</dd></div>
    </dl>
  {/if}
</Card>

<style>
  .head { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
  .message { font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file {
    margin: var(--space-3) 0 0;
    font-size: var(--text-lg);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file.empty { font-size: var(--text-sm); font-weight: 400; color: var(--text-faint); }
  .progress {
    margin-top: var(--space-4);
    height: 6px;
    border-radius: 999px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .fill { height: 100%; background: var(--accent); border-radius: inherit; transition: width 400ms ease; }
  dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: var(--space-3);
    margin: var(--space-4) 0 0;
  }
  dt { font-size: var(--text-xs); color: var(--text-muted); }
  dd { margin: 2px 0 0; font-size: var(--text-md); font-weight: 600; }
</style>

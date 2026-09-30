<script lang="ts">
  import { mdiContentCopy } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { ORCA_LAYER_CHANGE_GCODE, pauseAtLayerCommand, pauseNextLayerCommand } from '../lib/gcode'
  import { toasts } from '../lib/toasts.svelte'
  import Button from '../lib/ui/Button.svelte'
  import InlineNumber from '../lib/ui/InlineNumber.svelte'

  // State lives in the client macros' variables (Fluidd/Mainsail client.cfg).
  const macro = $derived(session.printer.raw('gcode_macro SET_PRINT_STATS_INFO'))
  const available = $derived(session.printer.has('gcode_macro SET_PAUSE_AT_LAYER') && macro != null)

  const atLayer = $derived.by(() => {
    const value = macro?.pause_at_layer
    if (value && typeof value === 'object' && 'enable' in value && value.enable && 'layer' in value) {
      return Number(value.layer)
    }
    return null
  })
  const nextLayer = $derived.by(() => {
    const value = macro?.pause_next_layer
    return value != null && typeof value === 'object' && 'enable' in value && value.enable === true
  })

  const info = $derived(job.stats?.info)
  const totalLayers = $derived(info?.total_layer ?? job.metadata?.layer_count ?? undefined)
  // The pause only fires when the slicer reports each layer to Klipper.
  const reporting = $derived(info?.current_layer != null)
  const settled = $derived(job.elapsed > 30)

  const copyHint = async () => {
    try {
      await navigator.clipboard.writeText(ORCA_LAYER_CHANGE_GCODE)
      toasts.push('Copied — paste it into Orca: Printer settings › Machine G-code › Layer change G-code', 'success')
    } catch {
      toasts.push(ORCA_LAYER_CHANGE_GCODE, 'info')
    }
  }
</script>

{#if available && job.active}
  <div class="pause">
    <span class="title">Pause</span>

    <div class="row">
      {#if atLayer != null}
        <span class="state">At layer <strong class="num">{atLayer}</strong></span>
        <Button size="sm" variant="ghost" disabled={!session.klippyReady} onclick={() => session.sendGcode(pauseAtLayerCommand(null))}>Clear</Button>
      {:else}
        <span class="state">At layer</span>
        <InlineNumber
          value={undefined}
          label="Pause at layer"
          min={(info?.current_layer ?? 0) + 1}
          max={totalLayers}
          width="64px"
          disabled={!session.klippyReady}
          onsubmit={(layer) => session.sendGcode(pauseAtLayerCommand(layer))}
        />
        {#if totalLayers}<span class="muted of num">of {totalLayers}</span>{/if}
      {/if}
    </div>

    <div class="row">
      {#if nextLayer}
        <span class="state"><strong>After this layer</strong></span>
        <Button size="sm" variant="ghost" disabled={!session.klippyReady} onclick={() => session.sendGcode(pauseNextLayerCommand(false))}>Cancel</Button>
      {:else}
        <Button size="sm" variant="outline" disabled={!session.klippyReady} onclick={() => session.sendGcode(pauseNextLayerCommand(true))}>Pause after this layer</Button>
      {/if}
    </div>

    {#if !reporting && settled}
      <p class="warning">
        Orca isn't reporting layers to Klipper, so these won't trigger. Add
        <code>{ORCA_LAYER_CHANGE_GCODE}</code> to Orca's layer change G-code.
        <Button size="sm" variant="ghost" icon={mdiContentCopy} onclick={copyHint}>Copy</Button>
      </p>
    {/if}
  </div>
{/if}

<style>
  .pause { display: flex; flex-direction: column; gap: var(--space-2); }
  .title { font-size: var(--text-xs); color: var(--text-muted); }
  .row { display: flex; align-items: center; gap: var(--space-2); min-height: 36px; font-size: var(--text-sm); }
  .state { flex: none; }
  .of { font-size: var(--text-xs); }
  .warning {
    margin: 0;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--warning-soft);
    color: var(--text);
    font-size: var(--text-xs);
    line-height: 1.5;
  }
  code { font-family: var(--font-mono); font-size: 11px; overflow-wrap: anywhere; }
</style>

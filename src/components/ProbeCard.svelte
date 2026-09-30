<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import Card from '../lib/ui/Card.svelte'
  import ConfirmButton from '../lib/ui/ConfirmButton.svelte'

  const settings = $derived(session.printer.get('configfile')?.settings)
  const probe = $derived(session.printer.get('probe'))
  const manual = $derived(session.printer.get('manual_probe'))
  const homed = $derived(session.printer.get('toolhead')?.homed_axes ?? '')

  // A probe calibrates its z_offset; without one, the Z endstop position.
  const probeSection = $derived(probe?.name ?? null)
  const zOffset = $derived.by(() => {
    const value = probeSection ? settings?.[probeSection]?.z_offset : undefined
    return typeof value === 'number' ? value : null
  })
  const endstopPosition = $derived.by(() => {
    const value = settings?.stepper_z?.position_endstop
    return typeof value === 'number' ? value : null
  })
  const available = $derived(probeSection != null || endstopPosition != null)

  const command = $derived(probeSection ? 'PROBE_CALIBRATE' : 'Z_ENDSTOP_CALIBRATE')
  const canRun = $derived(session.klippyReady && !job.active && !manual?.is_active)

  // Calibration needs a homed printer; home first rather than fail.
  const calibrate = () => session.sendGcode(homed === 'xyz' ? command : `G28\n${command}`)
</script>

{#if available}
  <Card title={probeSection ? 'Probe' : 'Z endstop'}>
    {#snippet aside()}
      {#if probeSection}<span class="mono">{probeSection}</span>{/if}
    {/snippet}

    <dl>
      {#if probeSection}
        <div><dt>Z offset</dt><dd class="num">{zOffset == null ? '—' : `${zOffset.toFixed(3)} mm`}</dd></div>
      {:else}
        <div><dt>Endstop position</dt><dd class="num">{endstopPosition?.toFixed(3)} mm</dd></div>
      {/if}
    </dl>
    <p class="muted hint">
      Calibrate with the paper test: the nozzle lowers onto a sheet of paper until it just drags.
      {homed === 'xyz' ? '' : 'Homes first.'}
    </p>

    <div class="actions">
      <ConfirmButton
        label="Calibrate"
        confirmLabel={homed === 'xyz' ? 'Start calibration?' : 'Home and calibrate?'}
        disabled={!canRun}
        title={job.active ? 'Not while printing' : `Runs ${command}`}
        onconfirm={calibrate}
      />
    </div>
  </Card>
{/if}

<style>
  dl { margin: 0; display: grid; gap: var(--space-2); font-size: var(--text-sm); }
  dl div { display: flex; justify-content: space-between; gap: var(--space-3); }
  dt { color: var(--text-muted); }
  dd { margin: 0; font-size: var(--text-lg); }
  .hint { margin: var(--space-3) 0 0; font-size: var(--text-xs); }
  .actions { display: flex; justify-content: flex-end; margin-top: var(--space-3); }
</style>

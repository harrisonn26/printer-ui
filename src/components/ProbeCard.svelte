<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import Card from '../lib/ui/Card.svelte'
  import ConfirmButton from '../lib/ui/ConfirmButton.svelte'
  import { isHomed, probeCalibrateScript, probeCalibrationTarget } from '../lib/gcode'

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

  const toolhead = $derived(session.printer.get('toolhead'))
  const pair = (value: unknown): [number, number] | undefined => (
    Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number' ? [value[0], value[1]] : undefined
  )
  const num = (value: unknown) => (typeof value === 'number' ? value : 0)

  // Start with the probe over the middle of the bed (it probes where it is,
  // then brings the nozzle over that spot), homing first if needed.
  const target = $derived.by(() => {
    if (!toolhead?.axis_minimum || !toolhead.axis_maximum) return null
    const section = probeSection ? settings?.[probeSection] : undefined
    return probeCalibrationTarget({
      meshMin: probeSection ? pair(settings?.bed_mesh?.mesh_min) : undefined,
      meshMax: probeSection ? pair(settings?.bed_mesh?.mesh_max) : undefined,
      axisMin: [toolhead.axis_minimum[0], toolhead.axis_minimum[1]],
      axisMax: [toolhead.axis_maximum[0], toolhead.axis_maximum[1]],
      probeOffset: [num(section?.x_offset), num(section?.y_offset)]
    })
  })

  const calibrate = () => {
    if (!target) return
    return session.sendGcode(probeCalibrateScript(command, target.toolhead, homed))
  }
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
      {isHomed(homed) ? '' : 'Homes first, then'}
      {#if target}{isHomed(homed) ? 'Probes' : 'probes'} at the middle of the bed ({target.probe[0]}, {target.probe[1]}).{/if}
    </p>

    <div class="actions">
      <ConfirmButton
        label="Calibrate"
        confirmLabel={isHomed(homed) ? 'Start calibration?' : 'Home and calibrate?'}
        disabled={!canRun || !target}
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

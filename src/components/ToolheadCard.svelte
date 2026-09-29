<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { moveCommand, zAdjustCommand, type Axis } from '../lib/gcode'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'
  import Segmented from '../lib/ui/Segmented.svelte'

  // mm/s, Fluidd's defaults.
  const XY_SPEED = 130
  const Z_SPEED = 10

  const STEPS = [0.1, 1, 10, 50].map(value => ({ value, label: String(value) }))
  const Z_STEPS = [0.005, 0.01, 0.025, 0.05].map(value => ({ value, label: String(value) }))

  let step = $state(10)
  let zStep = $state(0.025)
  let pending = $state<string | null>(null)

  const toolhead = $derived(session.printer.get('toolhead'))
  const gcodeMove = $derived(session.printer.get('gcode_move'))
  const motion = $derived(session.printer.get('motion_report'))

  const homed = $derived(toolhead?.homed_axes ?? '')
  const position = $derived(motion?.live_position ?? toolhead?.position)
  const zOffset = $derived(gcodeMove?.homing_origin?.[2] ?? 0)
  const clientMacro = $derived(session.printer.has('gcode_macro _CLIENT_LINEAR_MOVE'))

  // Jogging mid-print would fight the job; Z offset is meant for exactly then.
  const canMove = $derived(session.klippyReady && !job.active)

  const JOGS: { axis: Axis, sign: 1 | -1 }[] = [
    { axis: 'X', sign: -1 }, { axis: 'X', sign: 1 },
    { axis: 'Y', sign: -1 }, { axis: 'Y', sign: 1 },
    { axis: 'Z', sign: -1 }, { axis: 'Z', sign: 1 }
  ]

  const send = async (key: string, script: string) => {
    pending = key
    await session.sendGcode(script)
    pending = null
  }

  const jog = (axis: Axis, sign: 1 | -1) => send(
    `${axis}${sign}`,
    moveCommand({ [axis]: sign * step }, axis === 'Z' ? Z_SPEED : XY_SPEED, { clientMacro })
  )

  const fmt = (value: number | undefined, digits: number) => (value == null ? '—' : value.toFixed(digits))
</script>

<Card title="Toolhead">
  {#snippet aside()}
    <span class="num position" title="X · Y · Z">
      {fmt(position?.[0], 1)} · {fmt(position?.[1], 1)} · {fmt(position?.[2], 2)}
    </span>
  {/snippet}

  <div class="jog">
    {#each JOGS as { axis, sign } (`${axis}${sign}`)}
      <Button
        mono
        disabled={!canMove || !homed.includes(axis.toLowerCase())}
        loading={pending === `${axis}${sign}`}
        aria-label="Move {axis} {sign > 0 ? 'plus' : 'minus'} {step} millimetres"
        onclick={() => jog(axis, sign)}
      >{axis}{sign > 0 ? '+' : '−'}</Button>
    {/each}
    <Button
      class="home"
      disabled={!canMove}
      loading={pending === 'home'}
      onclick={() => send('home', 'G28')}
    >Home all</Button>
  </div>

  <div class="row">
    <span class="label">Step</span>
    <Segmented options={STEPS} bind:value={step} label="Jog distance in millimetres" size="sm" />
  </div>

  {#if homed !== 'xyz' && session.klippyReady}
    <p class="hint">
      {homed ? `Only ${homed.toUpperCase()} homed.` : 'Not homed.'} Home before jogging.
      <button type="button" class="link" disabled={!canMove} onclick={() => send('off', 'M84')}>Motors off</button>
    </p>
  {:else}
    <p class="hint">
      <button type="button" class="link" disabled={!canMove} onclick={() => send('off', 'M84')}>Motors off</button>
    </p>
  {/if}

  <div class="zoffset">
    <div class="row">
      <span class="label">Z offset</span>
      <span class="num value">{zOffset > 0 ? '+' : ''}{zOffset.toFixed(3)}</span>
      <Button
        size="sm"
        mono
        disabled={!session.klippyReady}
        aria-label="Lower nozzle {zStep} millimetres"
        onclick={() => send('z-', zAdjustCommand(-zStep, homed.includes('z')))}
      >−</Button>
      <Button
        size="sm"
        mono
        disabled={!session.klippyReady}
        aria-label="Raise nozzle {zStep} millimetres"
        onclick={() => send('z+', zAdjustCommand(zStep, homed.includes('z')))}
      >+</Button>
    </div>
    <Segmented options={Z_STEPS} bind:value={zStep} label="Z offset step in millimetres" size="sm" />
  </div>
</Card>

<style>
  .position { font-size: var(--text-xs); }
  .jog { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .jog :global(.home) { grid-column: span 2; color: var(--accent); }
  .row { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); }
  .row :global(.segmented) { flex: 1; }
  .label { width: 64px; flex: none; font-size: var(--text-xs); color: var(--text-muted); }
  .hint { margin: var(--space-2) 0 0; font-size: var(--text-xs); color: var(--text-muted); }
  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    font-size: inherit;
    cursor: pointer;
  }
  .link:disabled { color: var(--text-faint); cursor: not-allowed; }
  .zoffset { margin-top: var(--space-4); padding-top: var(--space-1); border-top: 1px solid var(--border); }
  .zoffset .row { margin-bottom: var(--space-2); }
  .value { flex: 1; font-size: var(--text-lg); }
</style>

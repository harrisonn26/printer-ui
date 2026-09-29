<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { encodeParamValue } from '../lib/gcode'
  import {
    activeMesh,
    axisValues,
    colourScale,
    meshStats,
    profileMesh,
    scalePosition,
    type Mesh
  } from '../lib/mesh'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'
  import Pill from '../lib/ui/Pill.svelte'

  const CONFIRM_MS = 4000

  let chosen = $state<string | null>(null)
  let pending = $state<string | null>(null)
  let confirmingCalibrate = $state(false)
  let confirmTimer: ReturnType<typeof setTimeout> | undefined

  $effect(() => () => clearTimeout(confirmTimer))

  const meshState = $derived(session.printer.get('bed_mesh'))
  const active = $derived(activeMesh(meshState))
  const profiles = $derived(Object.keys(meshState?.profiles ?? {}).sort())

  // Show what's chosen, else what's loaded, else the first saved profile.
  const name = $derived(chosen ?? active?.name ?? profiles[0] ?? null)
  const mesh = $derived.by((): Mesh | null => {
    if (!name) return null
    if (active && active.name === name) return active
    return profileMesh(meshState, name)
  })

  const stats = $derived(mesh ? meshStats(mesh.points) : null)
  const scale = $derived(stats ? colourScale(stats) : 0.1)
  const xs = $derived(mesh ? axisValues(mesh.min[0], mesh.max[0], mesh.points[0]?.length ?? 0) : [])
  // Back of the bed (highest Y) at the top, as you'd see it standing in front.
  const rows = $derived(mesh
    ? mesh.points
      .map((values, index) => ({ values, y: axisValues(mesh.min[1], mesh.max[1], mesh.points.length)[index] ?? 0 }))
      .reverse()
    : [])

  const canAct = $derived(session.klippyReady && !job.active)

  const cellColour = (value: number) => {
    const t = scalePosition(value, scale)
    const pole = t < 0 ? 'var(--mesh-low)' : 'var(--mesh-high)'
    return `color-mix(in oklab, ${pole} ${Math.round(Math.abs(t) * 100)}%, var(--mesh-mid))`
  }

  const mm = (value: number, digits = 3) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`

  const send = async (key: string, script: string) => {
    pending = key
    await session.sendGcode(script)
    pending = null
  }

  const calibrate = () => {
    if (!confirmingCalibrate) {
      confirmingCalibrate = true
      confirmTimer = setTimeout(() => { confirmingCalibrate = false }, CONFIRM_MS)
      return
    }
    clearTimeout(confirmTimer)
    confirmingCalibrate = false
    chosen = null
    void send('calibrate', 'BED_MESH_CALIBRATE')
  }
</script>

<Card title="Bed mesh">
  {#snippet aside()}
    {#if profiles.length > 1 || (profiles.length === 1 && !active)}
      <select
        value={name}
        aria-label="Mesh profile"
        onchange={(event) => { chosen = event.currentTarget.value }}
      >
        {#each profiles as profile (profile)}<option value={profile}>{profile}</option>{/each}
      </select>
    {/if}
  {/snippet}

  {#if !mesh || !stats}
    <p class="empty muted">No bed mesh yet. Calibrate to probe one.</p>
  {:else}
    <div class="summary">
      <div class="status">
        <span class="name">{mesh.name}</span>
        {#if mesh.active}
          <Pill tone="success">Active</Pill>
        {:else}
          <Pill tone="neutral">Saved, not loaded</Pill>
        {/if}
      </div>
      <dl>
        <div><dt>Range</dt><dd class="num">{stats.range.toFixed(3)} mm</dd></div>
        <div><dt>Lowest</dt><dd class="num">{mm(stats.min)}</dd></div>
        <div><dt>Highest</dt><dd class="num">{mm(stats.max)}</dd></div>
      </dl>
    </div>

    <div class="scroll">
      <table>
        <caption class="visually-hidden">Probed heights in mm, back of the bed at the top</caption>
        <thead>
          <tr>
            <th scope="col"><span class="visually-hidden">Y \ X</span></th>
            {#each xs as x, index (index)}<th scope="col" class="num axis">{Math.round(x)}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row, rowIndex (rowIndex)}
            <tr>
              <th scope="row" class="num axis">{Math.round(row.y)}</th>
              {#each row.values as value, index (index)}
                <td class="num" style:background={cellColour(value)} title="X {Math.round(xs[index] ?? 0)}, Y {Math.round(row.y)}: {mm(value, 4)} mm">
                  {mm(value, 2)}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="legend" aria-hidden="true">
      <span class="num">{mm(-scale, 2)}</span>
      <span class="gradient"></span>
      <span class="num">{mm(scale, 2)} mm</span>
    </div>
  {/if}

  <div class="actions">
    {#if mesh && !mesh.active}
      <Button
        variant="primary"
        size="sm"
        disabled={!canAct}
        loading={pending === 'load'}
        onclick={() => send('load', `BED_MESH_PROFILE LOAD=${encodeParamValue(mesh.name)}`)}
      >Load {mesh.name}</Button>
    {/if}
    {#if active}
      <Button size="sm" disabled={!canAct} loading={pending === 'clear'} onclick={() => send('clear', 'BED_MESH_CLEAR')}>Clear</Button>
    {/if}
    <Button
      size="sm"
      variant={confirmingCalibrate ? 'primary' : 'secondary'}
      disabled={!canAct}
      loading={pending === 'calibrate'}
      title={job.active ? 'Not while printing' : 'Probes the bed; home first'}
      onclick={calibrate}
    >{confirmingCalibrate ? 'Start probing?' : 'Calibrate'}</Button>
  </div>
</Card>

<style>
  select {
    height: 32px;
    padding: 0 var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-inset);
    font-size: var(--text-sm);
  }
  .empty { margin: var(--space-3) 0; font-size: var(--text-sm); }
  .summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3); margin-bottom: var(--space-4); }
  .status { display: flex; align-items: center; gap: var(--space-3); }
  .name { font-size: var(--text-lg); font-weight: 700; }
  dl { display: flex; gap: var(--space-5); margin: 0; }
  dt { font-size: var(--text-xs); color: var(--text-muted); }
  dd { margin: 0; }

  .scroll { overflow-x: auto; }
  table { border-collapse: separate; border-spacing: 2px; margin: 0 auto; }
  td {
    min-width: 56px;
    height: 44px;
    padding: 0 var(--space-2);
    border-radius: 6px;
    text-align: center;
    font-size: var(--text-xs);
    color: var(--text);
  }
  .axis { font-size: 11px; font-weight: 400; color: var(--text-faint); padding: 0 var(--space-2); }
  thead .axis { height: 24px; }

  .legend {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    margin-top: var(--space-3);
    font-size: 11px;
    color: var(--text-muted);
  }
  .gradient {
    width: 160px;
    height: 6px;
    border-radius: 999px;
    background: linear-gradient(to right, var(--mesh-low), var(--mesh-mid), var(--mesh-high));
  }

  .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>

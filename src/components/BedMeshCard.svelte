<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { meshCalibration } from '../lib/moonraker/mesh-calibration.svelte'
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
  import {
    isMeshComplete,
    meshGridFromSettings,
    parseProbeLine,
    probeOffsetsFromSettings,
    probeProgress,
    type ProbeSample
  } from '../lib/mesh-probe'
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
  const settings = $derived(session.printer.get('configfile')?.settings)
  const active = $derived(activeMesh(meshState))
  const profiles = $derived(Object.keys(meshState?.profiles ?? {}).sort())

  // Show what's chosen, else what's loaded, else the first saved profile.
  const name = $derived(chosen ?? active?.name ?? profiles[0] ?? null)
  const mesh = $derived.by((): Mesh | null => {
    if (!name) return null
    if (active && active.name === name) return active
    return profileMesh(meshState, name)
  })

  // --- Live calibration

  const grid = $derived(meshGridFromSettings(settings?.bed_mesh))
  const offsets = $derived(probeOffsetsFromSettings(settings))

  const runEntries = $derived(meshCalibration.after == null
    ? []
    : session.console.entries.filter(entry => entry.id > (meshCalibration.after ?? 0)))

  const samples = $derived(runEntries
    .map(entry => parseProbeLine(entry.message))
    .filter((sample): sample is ProbeSample => sample != null))

  const progress = $derived(meshCalibration.active && grid ? probeProgress(samples, grid, offsets) : null)

  // Finished on Klipper's "Mesh Bed Leveling Complete" (or, failing that, when
  // it publishes a new mesh); failed on a Klipper error.
  $effect(() => {
    if (!meshCalibration.active) return
    const failed = runEntries.find(entry => entry.kind === 'error')
    if (failed) {
      meshCalibration.finish(failed.message.replace(/^!!\s*/, ''))
      return
    }
    if (runEntries.some(entry => isMeshComplete(entry.message))) {
      chosen = null
      meshCalibration.finish()
      return
    }
    // Calibration first clears the mesh (an empty matrix): only a filled one counts.
    const matrix = meshState?.probed_matrix
    if (matrix && matrix !== meshCalibration.baseline && (matrix[0]?.length ?? 0) > 0) meshCalibration.finish()
  })

  // --- The grid being shown: live probing, or a mesh

  const probing = $derived(progress != null)
  const liveStats = $derived(progress
    ? meshStats(progress.values.map(row => row.filter((value): value is number => value != null)).filter(row => row.length))
    : null)
  const stats = $derived(probing ? liveStats : mesh ? meshStats(mesh.points) : null)
  const scale = $derived(stats ? colourScale(stats) : 0.1)

  const gridMin = $derived<[number, number]>(probing && grid ? grid.min : mesh?.min ?? [0, 0])
  const gridMax = $derived<[number, number]>(probing && grid ? grid.max : mesh?.max ?? [0, 0])
  const values = $derived<(number | null)[][]>(progress?.values ?? mesh?.points ?? [])
  const xs = $derived(axisValues(gridMin[0], gridMax[0], values[0]?.length ?? 0))
  const ys = $derived(axisValues(gridMin[1], gridMax[1], values.length))
  // Back of the bed (highest Y) at the top, as you'd see it standing in front.
  const rows = $derived(values.map((cells, index) => ({ cells, y: ys[index] ?? 0, index })).reverse())

  const canAct = $derived(session.klippyReady && !job.active && !meshCalibration.active)

  const cellColour = (value: number | null) => {
    if (value == null) return undefined
    const t = scalePosition(value, scale)
    const pole = t < 0 ? 'var(--mesh-low)' : 'var(--mesh-high)'
    return `color-mix(in oklab, ${pole} ${Math.round(Math.abs(t) * 100)}%, var(--mesh-mid))`
  }

  // Signed, with anything that rounds to zero shown as a plain 0 (never "-0.00").
  const mm = (value: number, digits = 3) => {
    const rounded = Number(value.toFixed(digits))
    if (rounded === 0) return (0).toFixed(digits)
    return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`
  }

  const send = async (key: string, script: string) => {
    pending = key
    const ok = await session.sendGcode(script)
    pending = null
    return ok
  }

  const calibrate = async () => {
    if (!confirmingCalibrate) {
      confirmingCalibrate = true
      confirmTimer = setTimeout(() => { confirmingCalibrate = false }, CONFIRM_MS)
      return
    }
    clearTimeout(confirmTimer)
    confirmingCalibrate = false
    chosen = null
    meshCalibration.start(session.console.entries.at(-1)?.id ?? 0, meshState?.probed_matrix)
    // Resolves when Klipper finishes the whole command, which is also how
    // long probing takes; the effect above usually finishes first.
    const ok = await send('calibrate', 'BED_MESH_CALIBRATE')
    if (!ok && meshCalibration.active) meshCalibration.finish('Calibration failed')
  }
</script>

<Card title="Bed mesh">
  {#snippet aside()}
    {#if !probing && (profiles.length > 1 || (profiles.length === 1 && !active))}
      <select
        value={name}
        aria-label="Mesh profile"
        onchange={(event) => { chosen = event.currentTarget.value }}
      >
        {#each profiles as profile (profile)}<option value={profile}>{profile}</option>{/each}
      </select>
    {/if}
  {/snippet}

  {#if probing && progress}
    <div class="probing" role="status">
      <div class="probing-head">
        <span class="name">Probing the bed</span>
        <span class="num count">{progress.done} / {progress.total} points</span>
      </div>
      <div class="bar"><div class="fill" style:width="{(progress.done / Math.max(progress.total, 1)) * 100}%"></div></div>
      {#if progress.offGrid > 0 && progress.done === 0}
        <p class="muted note">Probing points outside the configured grid (an adaptive mesh?) — the result shows when it finishes.</p>
      {/if}
    </div>
  {:else if meshCalibration.error}
    <p class="failed">Calibration stopped: {meshCalibration.error}</p>
  {/if}

  {#if !probing && (!mesh || !stats)}
    <p class="empty muted">No bed mesh yet. Calibrate to probe one.</p>
  {:else if values.length > 0}
    {#if !probing && mesh && stats}
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
    {/if}

    <div class="scroll">
      <table class:live={probing}>
        <caption class="visually-hidden">Probed heights in mm, back of the bed at the top</caption>
        <thead>
          <tr>
            <th scope="col"><span class="visually-hidden">Y \ X</span></th>
            {#each xs as x, index (index)}<th scope="col" class="num axis">{Math.round(x)}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.index)}
            <tr>
              <th scope="row" class="num axis">{Math.round(row.y)}</th>
              {#each row.cells as value, index (index)}
                {@const current = progress?.current?.[0] === index && progress?.current?.[1] === row.index}
                <td
                  class="num"
                  class:pending={value == null}
                  class:current
                  style:background={cellColour(value)}
                  title="X {Math.round(xs[index] ?? 0)}, Y {Math.round(row.y)}: {value == null ? 'not probed yet' : `${mm(value, 4)} mm`}"
                >
                  {value == null ? '' : mm(value, 2)}
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
    {#if mesh && !mesh.active && !probing}
      <Button
        variant="primary"
        size="sm"
        disabled={!canAct}
        loading={pending === 'load'}
        onclick={() => send('load', `BED_MESH_PROFILE LOAD=${encodeParamValue(mesh.name)}`)}
      >Load {mesh.name}</Button>
    {/if}
    {#if active && !probing}
      <Button size="sm" disabled={!canAct} loading={pending === 'clear'} onclick={() => send('clear', 'BED_MESH_CLEAR')}>Clear</Button>
    {/if}
    <Button
      size="sm"
      variant={confirmingCalibrate ? 'primary' : 'secondary'}
      disabled={!canAct}
      loading={probing}
      title={job.active ? 'Not while printing' : 'Probes the bed; home first'}
      onclick={calibrate}
    >{probing ? 'Probing…' : confirmingCalibrate ? 'Start probing?' : 'Calibrate'}</Button>
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

  .probing { margin-bottom: var(--space-4); }
  .probing-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
  .count { font-size: var(--text-sm); color: var(--text-muted); }
  .bar { height: 6px; margin-top: var(--space-2); border-radius: 999px; background: var(--control); overflow: hidden; }
  .fill { height: 100%; border-radius: inherit; background: var(--accent); transition: width 300ms ease; }
  .note { margin: var(--space-2) 0 0; font-size: var(--text-xs); }
  .failed { margin: 0 0 var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--danger-bg); color: var(--danger); font-size: var(--text-sm); }

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
    transition: background 300ms ease;
  }
  td.pending { background: var(--surface-inset); box-shadow: inset 0 0 0 1px var(--border); }
  td.current { box-shadow: inset 0 0 0 2px var(--accent); }
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

<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'
  import ConfirmButton from '../lib/ui/ConfirmButton.svelte'
  import { homeFirst, isHomed } from '../lib/gcode'
  import { screwPosition, screwTurn, turnFraction, wedgePath } from '../lib/screws'

  // Only shown when the config has [screws_tilt_adjust] or [bed_screws].
  const tilt = $derived(session.printer.get('screws_tilt_adjust'))
  const bedScrews = $derived(session.printer.get('bed_screws'))
  const settings = $derived(session.printer.get('configfile')?.settings)
  const canRun = $derived(session.klippyReady && !job.active)
  const homedAxes = $derived(session.printer.get('toolhead')?.homed_axes)
  const needsHoming = $derived(!isHomed(homedAxes))

  const screwName = (section: string, key: string) => {
    const name = settings?.[section]?.[`${key}_name`]
    return typeof name === 'string' && name ? name : key.replace(/^screw/, 'Screw ')
  }

  const results = $derived(Object.entries(tilt?.results ?? {})
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, result]) => ({ key, name: screwName('screws_tilt_adjust', key), ...result })))

  // Each screw's place relative to the others, spread across the square; y flipped so the front is at the bottom.
  const placed = $derived.by(() => {
    const points = results.map(result => screwPosition(settings?.screws_tilt_adjust?.[result.key]))
    if (points.some(point => point == null)) return null
    const xs = points.map(point => point![0])
    const ys = points.map(point => point![1])
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
    const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
    const scale = (value: number, min: number, max: number) => (max > min ? (value - min) / (max - min) : 0.5)
    return results.map((result, index) => ({
      ...result,
      left: 25 + scale(xs[index], minX, maxX) * 50,
      top: 72 - scale(ys[index], minY, maxY) * 46
    }))
  })

  const bedScrewNames = $derived(Object.keys(settings?.bed_screws ?? {})
    .filter(key => /^screw\d+$/.test(key))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
</script>

{#if tilt}
  <Card title="Bed screws">
    {#snippet aside()}
      <ConfirmButton
        label="Measure"
        confirmLabel={needsHoming ? 'Home and probe?' : 'Probe screws?'}
        variant="ghost"
        disabled={!canRun}
        title={job.active ? 'Not while printing' : 'Runs SCREWS_TILT_CALCULATE, homing first if needed'}
        onconfirm={() => session.sendGcode(homeFirst('SCREWS_TILT_CALCULATE', homedAxes))}
      />
    {/snippet}

    {#if results.length === 0}
      <p class="muted empty">Measure to see how far to turn each screw.</p>
    {:else}
      {#snippet dial(result: typeof results[number])}
        {@const fraction = turnFraction(result.adjust)}
        {@const clockwise = result.sign.trim().toUpperCase() === 'CW'}
        <svg class="dial" class:ccw={!clockwise} viewBox="-1.15 -1.15 2.3 2.3" aria-hidden="true">
          <circle class="face" r="1" />
          {#if !result.is_base && fraction != null && fraction > 0}
            <path class="wedge" d={wedgePath(fraction, clockwise)} />
          {/if}
          <line class="tick" x1="0" y1="-1" x2="0" y2="-0.7" />
          {#if result.is_base}<circle class="ref" r="0.28" />{/if}
        </svg>
      {/snippet}
      {#snippet label(result: typeof results[number])}
        <span class="name">{result.name}</span>
        <span class="turn" class:base={result.is_base} class:ccw={!result.is_base && result.sign.trim().toUpperCase() !== 'CW'}>
          {result.is_base ? 'Reference' : (screwTurn(result.sign, result.adjust) ?? `${result.sign} ${result.adjust}`)}
        </span>
        <span class="detail num">{result.z.toFixed(3)}{result.is_base ? '' : ` · ${result.adjust}`}</span>
      {/snippet}

      {#if placed}
        <div class="bed" role="list" aria-label="Bed seen from above, front at the bottom">
          <span class="edge">Front</span>
          {#each placed as result (result.key)}
            <div class="screw" role="listitem" style:left="{result.left}%" style:top="{result.top}%">
              {@render dial(result)}
              {@render label(result)}
            </div>
          {/each}
        </div>
      {:else}
        <ul class="screws">
          {#each results as result (result.key)}
            <li class="screw">{@render dial(result)}{@render label(result)}</li>
          {/each}
        </ul>
      {/if}
      <p class="hint">The shaded slice is how far to turn each screw, starting from 12 o'clock: clockwise (CW) or counter-clockwise (CCW) to match the reference.</p>
      {#if tilt.error}<p class="error">Probing failed; the results may be incomplete.</p>{/if}
    {/if}
  </Card>
{:else if bedScrews}
  <Card title="Bed screws">
    {#if bedScrews.is_active}
      <p class="status">
        {screwName('bed_screws', bedScrewNames[bedScrews.current_screw] ?? `screw${bedScrews.current_screw + 1}`)}
        — {bedScrews.state === 'fine' ? 'fine adjustment' : 'adjust'} with the paper test,
        {bedScrews.accepted_screws} of {bedScrewNames.length || '?'} accepted
      </p>
      <div class="actions">
        <Button size="sm" variant="ghost" onclick={() => session.sendGcode('ABORT')}>Abort</Button>
        <Button size="sm" onclick={() => session.sendGcode('ADJUSTED')}>Adjusted</Button>
        <Button size="sm" variant="primary" onclick={() => session.sendGcode('ACCEPT')}>Accept</Button>
      </div>
    {:else}
      <p class="muted empty">Step through each screw with the paper test.</p>
      <div class="actions">
        <ConfirmButton
          label="Start"
          confirmLabel={needsHoming ? 'Home and start?' : 'Start levelling?'}
          disabled={!canRun}
          title={job.active ? 'Not while printing' : 'Runs BED_SCREWS_ADJUST, homing first if needed'}
          onconfirm={() => session.sendGcode(homeFirst('BED_SCREWS_ADJUST', homedAxes))}
        />
      </div>
    {/if}
  </Card>
{/if}

<style>
  .empty { margin: 0; font-size: var(--text-sm); }
  .bed {
    position: relative;
    aspect-ratio: 1;
    max-width: 420px;
    margin: 0 auto;
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    box-shadow: inset 0 0 0 1px var(--border);
  }
  .edge { position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); }
  .bed .screw { position: absolute; transform: translate(-50%, -50%); width: 36%; }
  .screws { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); margin: 0; padding: 0; list-style: none; }
  .screw { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
  .dial { width: 48px; height: 48px; margin-bottom: var(--space-1); --turn: var(--accent); }
  .dial.ccw { --turn: var(--series-3); }
  .face { fill: var(--control); stroke: var(--border); stroke-width: 0.06; }
  .wedge { fill: var(--turn); }
  .tick { stroke: var(--text-faint); stroke-width: 0.08; stroke-linecap: round; }
  .ref { fill: var(--text-muted); }
  .name { font-size: var(--text-xs); color: var(--text-muted); }
  .turn { font-size: var(--text-sm); font-weight: 600; color: var(--accent); }
  .turn.ccw { color: var(--series-3); }
  .turn.base { color: var(--text-muted); font-weight: 400; }
  .detail { font-size: 11px; color: var(--text-faint); }
  .hint { margin: var(--space-3) 0 0; font-size: var(--text-xs); color: var(--text-faint); }
  .error { margin: var(--space-2) 0 0; font-size: var(--text-xs); color: var(--danger); }
  .status { margin: 0; font-size: var(--text-sm); }
  .actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); }
</style>

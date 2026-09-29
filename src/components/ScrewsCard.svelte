<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'
  import ConfirmButton from '../lib/ui/ConfirmButton.svelte'

  // Only shown when the config has [screws_tilt_adjust] or [bed_screws].
  const tilt = $derived(session.printer.get('screws_tilt_adjust'))
  const bedScrews = $derived(session.printer.get('bed_screws'))
  const settings = $derived(session.printer.get('configfile')?.settings)
  const canRun = $derived(session.klippyReady && !job.active)

  const screwName = (section: string, key: string) => {
    const name = settings?.[section]?.[`${key}_name`]
    return typeof name === 'string' && name ? name : key.replace(/^screw/, 'Screw ')
  }

  const results = $derived(Object.entries(tilt?.results ?? {})
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([key, result]) => ({ key, name: screwName('screws_tilt_adjust', key), ...result })))

  const bedScrewNames = $derived(Object.keys(settings?.bed_screws ?? {})
    .filter(key => /^screw\d+$/.test(key))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })))
</script>

{#if tilt}
  <Card title="Bed screws">
    {#snippet aside()}
      <ConfirmButton
        label="Measure"
        confirmLabel="Probe screws?"
        variant="ghost"
        disabled={!canRun}
        title={job.active ? 'Not while printing' : 'Runs SCREWS_TILT_CALCULATE; home first'}
        onconfirm={() => session.sendGcode('SCREWS_TILT_CALCULATE')}
      />
    {/snippet}

    {#if results.length === 0}
      <p class="muted empty">Measure to see how far to turn each screw.</p>
    {:else}
      <table>
        <thead>
          <tr><th scope="col">Screw</th><th scope="col">Height</th><th scope="col">Turn</th></tr>
        </thead>
        <tbody>
          {#each results as result (result.key)}
            <tr>
              <th scope="row">{result.name}</th>
              <td class="num">{result.z.toFixed(3)}</td>
              <td class="num turn" class:base={result.is_base}>
                {result.is_base ? 'Reference' : `${result.sign} ${result.adjust}`}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="hint">Turns are clockwise (CW) or counter-clockwise (CCW), in hours:minutes of a clock face.</p>
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
          confirmLabel="Start levelling?"
          disabled={!canRun}
          title={job.active ? 'Not while printing' : 'Runs BED_SCREWS_ADJUST; home first'}
          onconfirm={() => session.sendGcode('BED_SCREWS_ADJUST')}
        />
      </div>
    {/if}
  </Card>
{/if}

<style>
  .empty { margin: 0; font-size: var(--text-sm); }
  table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  thead th { padding-bottom: var(--space-2); text-align: left; font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); }
  tbody th { text-align: left; font-weight: 500; padding: var(--space-2) 0; }
  tbody tr + tr { border-top: 1px solid var(--border); }
  .turn { font-weight: 600; }
  .turn.base { color: var(--text-muted); font-weight: 400; }
  .hint { margin: var(--space-3) 0 0; font-size: var(--text-xs); color: var(--text-faint); }
  .error { margin: var(--space-2) 0 0; font-size: var(--text-xs); color: var(--danger); }
  .status { margin: 0; font-size: var(--text-sm); }
  .actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); }
</style>

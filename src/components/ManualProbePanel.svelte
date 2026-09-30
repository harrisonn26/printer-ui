<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { router } from '../lib/router.svelte'
  import { toasts } from '../lib/toasts.svelte'
  import Button from '../lib/ui/Button.svelte'

  // Shown on every page while Klipper waits on a manual probe (PROBE_CALIBRATE,
  // Z_ENDSTOP_CALIBRATE, BED_MESH with a manual probe…), however it was started.
  const manual = $derived(session.printer.get('manual_probe'))

  const STEPS = [-1, -0.1, -0.05, -0.01, 0.01, 0.05, 0.1, 1]

  let busy = $state(false)

  const send = async (script: string) => {
    busy = true
    await session.sendGcode(script)
    busy = false
  }

  const accept = async () => {
    busy = true
    const ok = await session.sendGcode('ACCEPT')
    busy = false
    if (ok) toasts.push('Accepted. Save it from the Machine page (Save & restart) to keep it.', 'success')
  }

  const hasBounds = $derived(manual?.z_position_lower != null || manual?.z_position_upper != null)
</script>

{#if manual?.is_active}
  <section class="panel" aria-labelledby="manual-probe-title">
    <div class="head">
      <div>
        <h2 id="manual-probe-title">Paper test</h2>
        <p class="muted">Slide a sheet of paper under the nozzle and lower it until the paper just drags.</p>
      </div>
      <div class="z">
        <span class="label">Z</span>
        <span class="num value">{manual.z_position?.toFixed(3) ?? '—'}</span>
        {#if hasBounds}
          <span class="num bounds">{manual.z_position_lower?.toFixed(3) ?? '?'} – {manual.z_position_upper?.toFixed(3) ?? '?'}</span>
        {/if}
      </div>
    </div>

    <div class="steps" role="group" aria-label="Move the nozzle">
      {#each STEPS as step (step)}
        <Button
          size="sm"
          mono
          disabled={busy}
          aria-label="{step < 0 ? 'Lower' : 'Raise'} {Math.abs(step)} millimetres"
          onclick={() => send(`TESTZ Z=${step}`)}
        >{step > 0 ? '+' : '−'}{Math.abs(step)}</Button>
      {/each}
    </div>

    <div class="actions">
      {#if hasBounds}
        <Button size="sm" variant="ghost" disabled={busy} onclick={() => send('TESTZ Z=-')}>Halfway down</Button>
        <Button size="sm" variant="ghost" disabled={busy} onclick={() => send('TESTZ Z=+')}>Halfway up</Button>
      {/if}
      <span class="spacer"></span>
      <Button size="sm" variant="ghost" disabled={busy} onclick={() => send('ABORT')}>Abort</Button>
      <Button size="sm" variant="primary" disabled={busy} onclick={accept}>Accept</Button>
    </div>
    {#if router.current !== '/machine'}
      <p class="muted foot">You can keep using the rest of the app; this stays here until you accept or abort.</p>
    {/if}
  </section>
{/if}

<style>
  .panel {
    margin-bottom: var(--space-4);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--accent);
    border-radius: var(--radius-lg);
    background: var(--surface);
  }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); }
  h2 { margin: 0; font-size: var(--text-md); font-weight: 700; }
  .head p { margin: var(--space-1) 0 0; font-size: var(--text-sm); }
  .z { display: flex; flex-direction: column; align-items: flex-end; flex: none; }
  .label { font-size: var(--text-xs); color: var(--text-muted); }
  .value { font-size: var(--text-xl); }
  .bounds { font-size: var(--text-xs); color: var(--text-faint); }
  .steps { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 6px; margin-top: var(--space-4); }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-top: var(--space-3); }
  .spacer { flex: 1; }
  .foot { margin: var(--space-2) 0 0; font-size: var(--text-xs); }

  @media (max-width: 760px) {
    .steps { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
</style>

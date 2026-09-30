<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { toasts } from '../lib/toasts.svelte'
  import Button from '../lib/ui/Button.svelte'

  // A modal on every page while Klipper waits on a manual probe
  // (PROBE_CALIBRATE, Z_ENDSTOP_CALIBRATE, …), however it was started. It only
  // goes away through Accept or Abort, because Klipper keeps waiting otherwise.
  const manual = $derived(session.printer.get('manual_probe'))
  const open = $derived(manual?.is_active === true)

  let dialog: HTMLDialogElement | undefined = $state()

  $effect(() => {
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  })

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

<dialog
  bind:this={dialog}
  aria-labelledby="manual-probe-title"
  oncancel={(event) => event.preventDefault()}
>
  {#if manual?.is_active}
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
          mono
          disabled={busy}
          aria-label="{step < 0 ? 'Lower' : 'Raise'} {Math.abs(step)} millimetres"
          onclick={() => send(`TESTZ Z=${step}`)}
        >{step > 0 ? '+' : '−'}{Math.abs(step)}</Button>
      {/each}
    </div>

    {#if hasBounds}
      <div class="bisect">
        <Button size="sm" variant="ghost" disabled={busy} onclick={() => send('TESTZ Z=-')}>Halfway down</Button>
        <Button size="sm" variant="ghost" disabled={busy} onclick={() => send('TESTZ Z=+')}>Halfway up</Button>
      </div>
    {/if}

    <div class="actions">
      <Button variant="ghost" disabled={busy} onclick={() => send('ABORT')}>Abort</Button>
      <Button variant="primary" disabled={busy} onclick={accept}>Accept</Button>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(560px, calc(100vw - 2 * var(--space-4)));
    padding: var(--space-5) var(--space-6);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.45);
  }
  dialog::backdrop { background: rgb(0 0 0 / 0.55); backdrop-filter: blur(2px); }
  .head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); }
  h2 { margin: 0; font-size: var(--text-lg); font-weight: 700; }
  .head p { margin: var(--space-1) 0 0; font-size: var(--text-sm); }
  .z { display: flex; flex-direction: column; align-items: flex-end; flex: none; }
  .label { font-size: var(--text-xs); color: var(--text-muted); }
  .value { font-size: var(--text-2xl); line-height: 1.1; }
  .bounds { font-size: var(--text-xs); color: var(--text-faint); }
  .steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: var(--space-5); }
  .bisect { display: flex; justify-content: center; gap: var(--space-2); margin-top: var(--space-2); }
  .actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-5); padding-top: var(--space-4); border-top: 1px solid var(--border); }

  @media (max-width: 760px) {
    dialog { padding: var(--space-4); }
    .head { flex-direction: column; }
    .z { align-items: flex-start; }
  }
</style>

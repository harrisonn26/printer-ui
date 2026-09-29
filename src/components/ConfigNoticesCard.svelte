<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import ConfirmButton from '../lib/ui/ConfirmButton.svelte'

  const configfile = $derived(session.printer.get('configfile'))
  const klipperWarnings = $derived(configfile?.warnings ?? [])
  const moonrakerWarnings = $derived(session.server?.warnings ?? [])
  const pendingSave = $derived(configfile?.save_config_pending === true)
  const pendingSections = $derived(Object.keys(configfile?.save_config_pending_items ?? {}))
  const busy = $derived(job.active)

  const any = $derived(pendingSave || klipperWarnings.length > 0 || moonrakerWarnings.length > 0)
</script>

{#if any}
  <section class="notices">
    {#if pendingSave}
      <div class="notice save">
        <div class="text">
          <strong>Unsaved configuration changes</strong>
          <span class="muted">
            {pendingSections.length ? pendingSections.join(', ') : 'Klipper has changes waiting'} — saving restarts Klipper.
          </span>
        </div>
        <ConfirmButton
          label="Save & restart"
          confirmLabel="Restart Klipper?"
          variant="outline"
          disabled={!session.klippyReady || busy}
          title={busy ? 'Not while printing' : undefined}
          onconfirm={() => session.sendGcode('SAVE_CONFIG')}
        />
      </div>
    {/if}

    {#each klipperWarnings as warning, index (index)}
      <div class="notice warning">
        <div class="text">
          <strong>Klipper config</strong>
          <span>{warning.message}</span>
        </div>
      </div>
    {/each}

    {#each moonrakerWarnings as warning (warning)}
      <div class="notice warning">
        <div class="text">
          <strong>Moonraker</strong>
          <span>{warning}</span>
        </div>
      </div>
    {/each}
  </section>
{/if}

<style>
  .notices { display: flex; flex-direction: column; gap: var(--space-2); }
  .notice {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-lg);
    font-size: var(--text-sm);
  }
  .save { background: var(--accent-soft); }
  .warning { background: var(--warning-soft); }
  .warning strong { color: var(--warning); }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; overflow-wrap: anywhere; }
</style>

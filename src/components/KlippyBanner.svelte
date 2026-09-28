<script lang="ts">
  import { mdiAlertCircleOutline, mdiRestart } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Icon from '../lib/ui/Icon.svelte'

  let pending = $state<string | null>(null)

  const klippyState = $derived(session.klippy.state)
  const title = $derived({
    unknown: 'Checking Klipper…',
    startup: 'Klipper is starting',
    disconnected: 'Klipper is not connected',
    error: 'Klipper reported an error',
    shutdown: 'Klipper has shut down',
    ready: ''
  }[klippyState])

  const run = async (method: string, params?: Record<string, unknown>) => {
    pending = method
    await session.run(method, params)
    pending = null
  }
</script>

<div class="banner" class:info={klippyState === 'startup' || klippyState === 'unknown'} role="alert">
  <Icon path={mdiAlertCircleOutline} size={22} />
  <div class="text">
    <strong>{title}</strong>
    {#if session.klippy.message}<pre>{session.klippy.message}</pre>{/if}
  </div>
  <div class="actions">
    {#if klippyState === 'disconnected'}
      <Button
        size="sm"
        icon={mdiRestart}
        loading={pending === 'machine.services.restart'}
        onclick={() => run('machine.services.restart', { service: 'klipper' })}
      >Restart service</Button>
    {:else if klippyState === 'error' || klippyState === 'shutdown'}
      <Button
        size="sm"
        icon={mdiRestart}
        loading={pending === 'printer.restart'}
        onclick={() => run('printer.restart')}
      >Restart</Button>
      <Button
        size="sm"
        icon={mdiRestart}
        loading={pending === 'printer.firmware_restart'}
        onclick={() => run('printer.firmware_restart')}
      >Firmware restart</Button>
    {/if}
  </div>
</div>

<style>
  .banner {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-lg);
    background: var(--danger-soft);
    color: var(--danger);
  }
  .banner.info { background: var(--accent-soft); color: var(--accent); }
  .text { flex: 1; min-width: 0; color: var(--text); }
  strong { display: block; font-size: var(--text-sm); }
  pre {
    margin: var(--space-1) 0 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--text-muted);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  @media (max-width: 600px) {
    .banner { flex-wrap: wrap; }
    .actions { width: 100%; }
  }
</style>

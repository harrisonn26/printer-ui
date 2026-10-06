<script lang="ts">
  import { mdiAlertCircleOutline, mdiRestart } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { errorMessage, isSocketError } from '../lib/moonraker/errors'
  import { toasts } from '../lib/toasts.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Icon from '../lib/ui/Icon.svelte'

  const GIVE_UP_MS = 20_000

  const klippyState = $derived(session.klippy.state)
  const message = $derived(session.klippy.message)
  const title = $derived({
    unknown: 'Checking Klipper…',
    startup: 'Klipper is starting',
    disconnected: 'Klipper is not connected',
    error: 'Klipper reported an error',
    shutdown: 'Klipper has shut down',
    ready: ''
  }[klippyState])

  // Several printers can share a host (klipper, klipper-ender5, …): only ever
  // restart this printer's own service.
  const ownService = $derived(session.system.info?.instance_ids?.klipper ?? null)

  // A lost MCU or an emergency stop leaves the MCU shut down, which a plain
  // RESTART can't clear — Klipper says to use FIRMWARE_RESTART.
  const firmwareFirst = $derived(/FIRMWARE_RESTART|MCU|webhooks request|emergency/i.test(message))

  /**
   * The spinner follows Klipper, not the request: a restart's reply can sit
   * behind another G-code command for minutes, or never come (Klipper drops
   * the connection while restarting). It stops when Klipper's state moves.
   */
  let pending = $state<{ key: string, from: string, at: number } | null>(null)

  $effect(() => {
    if (pending && klippyState !== pending.from) pending = null
  })

  $effect(() => {
    if (!pending) return
    const started = pending
    const timer = setTimeout(() => {
      if (pending !== started) return
      pending = null
      toasts.push("Klipper hasn't reacted yet. It may still be finishing another command, or the printer's board isn't responding — check its USB and power.", 'warning')
    }, GIVE_UP_MS)
    return () => clearTimeout(timer)
  })

  const act = (key: string, method: string, params?: Record<string, unknown>) => {
    pending = { key, from: klippyState, at: Date.now() }
    session.call(method, params).catch(error => {
      // "Klippy Disconnected" is the restart working, not a failure.
      if (isSocketError(error) && error.code === 503) return
      if (pending?.key === key) pending = null
      toasts.push(errorMessage(error), 'error')
    })
  }
</script>

{#if klippyState !== 'ready'}
<div class="banner" class:info={klippyState === 'startup' || klippyState === 'unknown'} role="alert">
  <Icon path={mdiAlertCircleOutline} size={22} />
  <div class="text">
    <strong>{title}</strong>
    {#if message}<pre>{message}</pre>{/if}
  </div>
  <div class="actions">
    {#if klippyState === 'disconnected'}
      <Button
        size="sm"
        icon={mdiRestart}
        disabled={!ownService || pending != null}
        loading={pending?.key === 'service'}
        title={ownService ? `Restarts the ${ownService} service` : "Couldn't tell which Klipper service belongs to this printer"}
        onclick={() => act('service', 'machine.services.restart', { service: ownService })}
      >Restart {ownService ?? 'service'}</Button>
    {:else if klippyState === 'error' || klippyState === 'shutdown'}
      <Button
        size="sm"
        variant={firmwareFirst ? 'primary' : 'secondary'}
        icon={mdiRestart}
        disabled={pending != null}
        loading={pending?.key === 'firmware'}
        onclick={() => act('firmware', 'printer.firmware_restart')}
      >Firmware restart</Button>
      <Button
        size="sm"
        icon={mdiRestart}
        disabled={pending != null}
        loading={pending?.key === 'restart'}
        title={firmwareFirst ? 'Reloads the config only; the MCU needs a firmware restart' : 'Reloads the config'}
        onclick={() => act('restart', 'printer.restart')}
      >Restart</Button>
    {/if}
  </div>
</div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--danger-border);
    border-radius: var(--radius-lg);
    background: var(--danger-bg);
    color: var(--danger);
  }
  .banner.info { background: var(--surface); border-color: var(--border); color: var(--accent); }
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

<script lang="ts">
  import { mdiPower } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import ConfirmButton from '../lib/ui/ConfirmButton.svelte'
  import Icon from '../lib/ui/Icon.svelte'
  import Pill from '../lib/ui/Pill.svelte'

  let open = $state(false)
  let root: HTMLDivElement | undefined = $state()
  let trigger: HTMLButtonElement | undefined = $state()

  $effect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (root && !root.contains(event.target as Node)) open = false
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        open = false
        trigger?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  })

  const power = $derived(session.system.power)
  const hasOffDevice = $derived(power.some(device => device.status === 'off'))
</script>

{#if power.length > 0}
  <div class="power-control" bind:this={root}>
    <button
      bind:this={trigger}
      type="button"
      class="trigger"
      class:needs-power={hasOffDevice}
      aria-expanded={open}
      aria-controls="power-panel"
      title={hasOffDevice ? 'Power — a device is off' : 'Power controls'}
      onclick={() => { open = !open }}
    >
      <Icon path={mdiPower} size={18} />
      Power
      {#if hasOffDevice}<span class="indicator" aria-label="A device is off"></span>{/if}
    </button>
    {#if open}
  <section id="power-panel" class="power-panel" aria-labelledby="power-heading">
    <div class="heading">
      <Icon path={mdiPower} size={20} />
      <div>
        <h2 id="power-heading">Power</h2>
        {#if hasOffDevice}<p>Turn on your printer and accessories here.</p>{/if}
      </div>
    </div>
    <ul>
      {#each power as device (device.device)}
        {@const locked = device.locked_while_printing && job.active}
        <li>
          <div class="device">
            <span class="name">{device.device}</span>
            {#if locked}<span class="lock muted">Locked while printing</span>{/if}
          </div>
          <Pill tone={device.status === 'on' ? 'success' : device.status === 'error' ? 'danger' : 'neutral'}>{device.status}</Pill>
          <ConfirmButton
            icon={mdiPower}
            label={device.status === 'on' ? 'Turn off' : 'Turn on'}
            confirmLabel={device.status === 'on' ? 'Turn off' : 'Turn on'}
            confirmTitle={`${device.status === 'on' ? 'Turn off' : 'Turn on'} ${device.device}?`}
            confirmVariant={device.status === 'on' ? 'danger' : 'primary'}
            variant={device.status === 'on' ? 'ghost' : 'secondary'}
            disabled={!session.ready || locked || device.status === 'init'}
            title={locked ? 'Moonraker locks this device while the printer is printing' : undefined}
            onconfirm={() => session.run('machine.device_power.post_device', {
              device: device.device,
              action: device.status === 'on' ? 'off' : 'on'
            })}
          />
        </li>
      {/each}
    </ul>
  </section>
    {/if}
  </div>
{/if}

<style>
  .power-control { position: relative; flex: none; }
  .trigger { display: inline-flex; align-items: center; gap: var(--space-2); height: 36px; padding: 0 var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); font-size: var(--text-sm); font-weight: 700; cursor: pointer; }
  .trigger:hover, .trigger[aria-expanded='true'] { background: var(--control); }
  .needs-power { border-color: var(--accent); color: var(--accent); }
  .indicator { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
  .power-panel { position: absolute; top: calc(100% + 10px); right: 0; z-index: 30; width: min(380px, calc(100vw - 32px)); padding: var(--space-4); background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-lg); box-shadow: 0 12px 32px rgb(0 0 0 / 0.35); }
  .heading { display: flex; align-items: center; gap: var(--space-3); flex: none; }
  h2 { margin: 0; font-size: var(--text-sm); font-weight: 700; }
  p { margin: var(--space-1) 0 0; color: var(--text-muted); font-size: var(--text-xs); }
  ul { list-style: none; margin: var(--space-3) 0 0; padding: 0; }
  li { display: flex; align-items: center; gap: var(--space-3); min-width: 0; padding: var(--space-2) 0; }
  li + li { border-top: 1px solid var(--border); }
  .device { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .name { font-size: var(--text-sm); overflow-wrap: anywhere; }
  .lock { font-size: var(--text-xs); }
  @media (max-width: 480px) {
    .power-panel { position: fixed; top: 62px; right: 16px; max-height: calc(100svh - 140px); overflow-y: auto; }
  }
</style>

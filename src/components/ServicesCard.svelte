<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import type { Tone } from '../lib/machine'
  import Card from '../lib/ui/Card.svelte'
  import ConfirmButton from '../lib/ui/ConfirmButton.svelte'
  import Pill from '../lib/ui/Pill.svelte'

  const info = $derived(session.system.info)
  const services = $derived((info?.available_services ?? []).map(name => {
    const state = info?.service_state?.[name]
    return { name, active: state?.active_state ?? 'unknown', sub: state?.sub_state ?? '' }
  }))
  const power = $derived(session.system.power)

  const serviceTone = (active: string): Tone => (
    active === 'active' ? 'success' : active === 'activating' || active === 'reloading' ? 'accent' : active === 'failed' ? 'danger' : 'neutral'
  )

  const powerTone = (status: Moonraker.Power.DeviceState): Tone => (
    status === 'on' ? 'success' : status === 'error' ? 'danger' : 'neutral'
  )

  // Restarting Klipper ends a print, and it isn't worth reasoning about which
  // services are safe mid-print: all of them wait.
  const busy = $derived(job.active)
</script>

<Card title="Services">
  {#if services.length === 0}
    <p class="muted empty">No services reported.</p>
  {:else}
    <ul>
      {#each services as service (service.name)}
        <li>
          <span class="name mono">{service.name}</span>
          <Pill tone={serviceTone(service.active)}>{service.sub || service.active}</Pill>
          {#if service.active === 'active'}
            <ConfirmButton
              label="Restart"
              confirmLabel="Restart?"
              variant="ghost"
              disabled={!session.ready || busy}
              title={busy ? 'Not while printing' : undefined}
              onconfirm={() => session.run('machine.services.restart', { service: service.name })}
            />
          {:else}
            <ConfirmButton
              label="Start"
              confirmLabel="Start?"
              variant="ghost"
              disabled={!session.ready}
              onconfirm={() => session.run('machine.services.start', { service: service.name })}
            />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</Card>

{#if power.length > 0}
  <Card title="Power">
    <ul>
      {#each power as device (device.device)}
        {@const locked = device.locked_while_printing && busy}
        <li>
          <span class="name">{device.device}</span>
          <Pill tone={powerTone(device.status)}>{device.status}</Pill>
          <ConfirmButton
            label={device.status === 'on' ? 'Turn off' : 'Turn on'}
            confirmLabel={device.status === 'on' ? 'Turn off?' : 'Turn on?'}
            confirmVariant={device.status === 'on' ? 'danger' : 'primary'}
            variant="ghost"
            disabled={!session.ready || locked || device.status === 'init'}
            title={locked ? 'Locked while printing' : undefined}
            onconfirm={() => session.run('machine.device_power.post_device', {
              device: device.device,
              action: device.status === 'on' ? 'off' : 'on'
            })}
          />
        </li>
      {/each}
    </ul>
  </Card>
{/if}

<style>
  .empty { margin: 0; font-size: var(--text-sm); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: var(--space-3); min-height: 48px; }
  li + li { border-top: 1px solid var(--border); }
  .name { flex: 1; min-width: 0; font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>

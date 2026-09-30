<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { formatBytes } from '../lib/files'
  import { formatDuration } from '../lib/format'
  import { batteryLabel } from '../lib/battery'
  import Card from '../lib/ui/Card.svelte'
  import ConfirmButton from '../lib/ui/ConfirmButton.svelte'

  let disk = $state.raw<Moonraker.Files.DiskUsage | null>(null)
  // system_uptime only comes with the first proc_stats; count on from there.
  let uptimeBase = $state<{ seconds: number, at: number } | null>(null)
  let now = $state(Date.now())

  const info = $derived(session.system.info)
  const stats = $derived(session.system.stats)

  $effect(() => {
    if (!session.ready) return
    session.call<Moonraker.Files.GetDirectoryResponse>('server.files.get_directory', { path: 'gcodes' })
      .then(response => { disk = response.disk_usage })
      .catch(() => { disk = null })
  })

  $effect(() => {
    const uptime = stats?.system_uptime
    if (uptime != null && uptimeBase == null) uptimeBase = { seconds: uptime, at: Date.now() }
  })

  $effect(() => {
    const timer = setInterval(() => { now = Date.now() }, 1000)
    return () => clearInterval(timer)
  })

  const cpu = $derived(stats?.system_cpu_usage?.cpu ?? null)
  const memory = $derived(stats?.system_memory ?? null)
  const memoryShare = $derived(memory && memory.total ? memory.used / memory.total : null)
  const diskShare = $derived(disk && disk.total ? disk.used / disk.total : null)
  const uptime = $derived(uptimeBase ? uptimeBase.seconds + (now - uptimeBase.at) / 1000 : null)
  const throttled = $derived(stats?.throttled_state?.flags ?? [])

  const kb = (value: number) => formatBytes(value * 1024)
  const uptimeText = (seconds: number) => {
    const days = Math.floor(seconds / 86_400)
    return days > 0 ? `${days}d ${formatDuration(seconds % 86_400)}` : formatDuration(seconds)
  }

  const busy = $derived(job.active)
  const battery = $derived(session.system.battery)
</script>

<Card title="Host">
  {#snippet aside()}
    {#if info}<span>{info.distribution.name}</span>{/if}
  {/snippet}

  <div class="tiles">
    <div class="tile">
      <span class="label">CPU</span>
      <span class="value num">{cpu == null ? '—' : `${Math.round(cpu)}%`}</span>
      <div class="meter"><div class="fill" style:width="{cpu ?? 0}%"></div></div>
    </div>
    <div class="tile">
      <span class="label">Memory</span>
      <span class="value num">{memory ? kb(memory.used) : '—'}</span>
      <div class="meter"><div class="fill" style:width="{(memoryShare ?? 0) * 100}%"></div></div>
      {#if memory}<span class="sub num">of {kb(memory.total)}</span>{/if}
    </div>
    <div class="tile">
      <span class="label">Disk</span>
      <span class="value num">{disk ? formatBytes(disk.free) : '—'}</span>
      <div class="meter"><div class="fill" style:width="{(diskShare ?? 0) * 100}%"></div></div>
      {#if disk}<span class="sub num">free of {formatBytes(disk.total)}</span>{/if}
    </div>
    <div class="tile">
      <span class="label">CPU temp</span>
      <span class="value num">{stats?.cpu_temp == null ? '—' : `${stats.cpu_temp.toFixed(1)}°`}</span>
      {#if uptime != null}<span class="sub num">up {uptimeText(uptime)}</span>{/if}
    </div>
    {#if battery}
      <div class="tile" class:alert={battery.onBattery && !battery.stale}>
        <span class="label">Battery</span>
        <span class="value num">{battery.capacity == null ? '—' : `${battery.capacity}%`}</span>
        <div class="meter"><div class="fill" style:width="{battery.capacity ?? 0}%"></div></div>
        <span class="sub">{battery.stale ? 'No recent reading' : batteryLabel(battery)}</span>
      </div>
    {/if}
  </div>

  {#if throttled.length}
    <ul class="throttled">
      {#each throttled as flag (flag)}<li>{flag}</li>{/each}
    </ul>
  {/if}

  {#if info}
    <dl>
      {#if info.cpu_info}<div><dt>Processor</dt><dd>{info.cpu_info.cpu_desc || info.cpu_info.processor} · {info.cpu_info.cpu_count} cores</dd></div>{/if}
      {#if info.distribution.kernel_version}<div><dt>Kernel</dt><dd class="mono">{info.distribution.kernel_version}</dd></div>{/if}
      <div><dt>Python</dt><dd class="mono">{info.python.version_string.split(' ')[0]}</dd></div>
    </dl>
  {/if}

  <div class="actions">
    <ConfirmButton
      label="Reboot host"
      confirmLabel="Reboot now?"
      confirmVariant="danger"
      disabled={!session.ready || busy}
      title={busy ? 'Not while printing' : undefined}
      onconfirm={() => session.run('machine.reboot')}
    />
    <ConfirmButton
      label="Shut down host"
      confirmLabel="Shut down now?"
      confirmVariant="danger"
      disabled={!session.ready || busy}
      title={busy ? 'Not while printing' : undefined}
      onconfirm={() => session.run('machine.shutdown')}
    />
  </div>
</Card>

<style>
  .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
  }
  .label { font-size: var(--text-xs); color: var(--text-muted); }
  .value { font-size: var(--text-lg); }
  .sub { font-size: 11px; color: var(--text-faint); }
  .meter { height: 4px; margin: var(--space-1) 0 2px; border-radius: 999px; background: var(--control); overflow: hidden; }
  .fill { height: 100%; background: var(--accent); transition: width 400ms ease; }
  .tile.alert { box-shadow: inset 0 0 0 1px var(--warning); }
  .tile.alert .fill { background: var(--warning); }
  .tile.alert .sub { color: var(--warning); }

  .throttled {
    margin: var(--space-3) 0 0;
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-5);
    border-radius: var(--radius-sm);
    background: var(--warning-soft);
    color: var(--warning);
    font-size: var(--text-xs);
  }

  dl { display: grid; gap: var(--space-1); margin: var(--space-4) 0 0; font-size: var(--text-sm); }
  dl div { display: flex; justify-content: space-between; gap: var(--space-3); }
  dt { color: var(--text-muted); }
  dd { margin: 0; text-align: right; overflow-wrap: anywhere; }

  .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
</style>

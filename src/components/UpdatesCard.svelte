<script lang="ts">
  import { tick } from 'svelte'
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { updateMethod, updateSummary, type UpdateState } from '../lib/moonraker/system.svelte'
  import type { Tone } from '../lib/machine'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'
  import ConfirmButton from '../lib/ui/ConfirmButton.svelte'
  import Pill from '../lib/ui/Pill.svelte'

  let checking = $state(false)
  let log: HTMLPreElement | undefined = $state()

  const system = session.system
  const busy = $derived(job.active)

  // Moonraker first, then Klipper, then clients and the OS last.
  const RANK: Record<string, number> = { moonraker: 0, klipper: 1, system: 99 }
  const entries = $derived(Object.entries(system.updates?.version_info ?? {})
    .map(([name, entry]) => ({ name, entry, ...updateSummary(entry) }))
    .sort((a, b) => (RANK[a.name] ?? 50) - (RANK[b.name] ?? 50) || a.name.localeCompare(b.name)))

  const TONES: Record<UpdateState, Tone> = { current: 'success', available: 'accent', problem: 'warning' }

  const check = async () => {
    checking = true
    const result = await session.run<Moonraker.UpdateManager.StatusResponse>('machine.update.refresh')
    if (result) system.updates = result
    checking = false
  }

  const update = async (name: string, entry: Moonraker.UpdateManager.VersionInfoEntry) => {
    const { method, params } = updateMethod(name, entry)
    system.updateLog = []
    system.updating = name
    const result = await session.run(method, params)
    // Failed to start: nothing will report completion.
    if (result === undefined) system.updating = null
  }

  $effect(() => {
    void system.updateLog.length
    void tick().then(() => { if (log) log.scrollTop = log.scrollHeight })
  })

  const versionText = (entry: Moonraker.UpdateManager.VersionInfoEntry) => {
    if (!('version' in entry)) return null
    const remote = entry.remote_version
    return remote && remote !== '?' && remote !== entry.version ? `${entry.version} → ${remote}` : entry.version
  }
</script>

<Card title="Updates">
  {#snippet aside()}
    <Button
      variant="ghost"
      size="sm"
      loading={checking}
      disabled={!session.ready || busy || system.updating != null}
      title={busy ? 'Not while printing' : undefined}
      onclick={check}
    >Check now</Button>
  {/snippet}

  {#if entries.length === 0}
    <p class="muted empty">Update manager isn't configured.</p>
  {:else}
    <ul>
      {#each entries as { name, entry, state, detail } (name)}
        <li>
          <div class="text">
            <span class="name">{name}</span>
            {#if versionText(entry)}<span class="version num">{versionText(entry)}</span>{/if}
          </div>
          <Pill tone={TONES[state]}>{detail}</Pill>
          {#if state === 'available'}
            <ConfirmButton
              label="Update"
              confirmLabel="Update {name}?"
              variant="outline"
              disabled={!session.ready || busy || system.updating != null}
              title={busy ? 'Not while printing' : undefined}
              onconfirm={() => update(name, entry)}
            />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if system.updating || system.updateLog.length}
    <div class="progress">
      <div class="progress-head">
        <span>{system.updating ? `Updating ${system.updating}…` : 'Last update output'}</span>
        {#if !system.updating}
          <Button variant="ghost" size="sm" onclick={() => { system.updateLog = [] }}>Dismiss</Button>
        {/if}
      </div>
      <pre bind:this={log} class="mono">{system.updateLog.join('\n')}</pre>
    </div>
  {/if}
</Card>

<style>
  .empty { margin: 0; font-size: var(--text-sm); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: var(--space-3); min-height: 52px; }
  li + li { border-top: 1px solid var(--border); }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .name { font-weight: 600; font-size: var(--text-sm); }
  .version { font-size: var(--text-xs); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .progress { margin-top: var(--space-3); }
  .progress-head { display: flex; align-items: center; justify-content: space-between; font-size: var(--text-sm); color: var(--text-muted); }
  pre {
    max-height: 200px;
    margin: var(--space-2) 0 0;
    padding: var(--space-3);
    overflow: auto;
    border-radius: var(--radius-sm);
    background: var(--surface-inset);
    font-size: var(--text-xs);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>

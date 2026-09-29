<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { formatAgo } from '../lib/files'
  import { formatDuration, jobTitle } from '../lib/format'
  import { errorMessage } from '../lib/moonraker/errors'
  import type { Tone } from '../lib/machine'
  import Button from '../lib/ui/Button.svelte'
  import Pill from '../lib/ui/Pill.svelte'
  import Thumbnail from '../lib/ui/Thumbnail.svelte'
  import StartPrintButton from './StartPrintButton.svelte'

  const PAGE = 50

  let limit = $state(PAGE)
  let history = $state.raw<Moonraker.History.ListResponse | null>(null)
  let error = $state<string | null>(null)

  $effect(() => {
    void session.historyRevision
    const pageLimit = limit
    let current = true
    session.call<Moonraker.History.ListResponse>('server.history.list', { limit: pageLimit, order: 'desc' })
      .then(response => {
        if (!current) return
        history = response
        error = null
      })
      .catch(e => {
        if (current) error = errorMessage(e)
      })
    return () => { current = false }
  })

  const STATUS: Record<Moonraker.History.HistoryItemStatus, { label: string, tone: Tone }> = {
    completed: { label: 'Completed', tone: 'success' },
    cancelled: { label: 'Cancelled', tone: 'neutral' },
    error: { label: 'Error', tone: 'danger' },
    printing: { label: 'Printing', tone: 'accent' },
    in_progress: { label: 'Printing', tone: 'accent' },
    server_exit: { label: 'Interrupted', tone: 'warning' },
    klippy_shutdown: { label: 'Shutdown', tone: 'danger' },
    klippy_disconnect: { label: 'Disconnected', tone: 'danger' },
    interrupted: { label: 'Interrupted', tone: 'warning' }
  }

  const statusOf = (status: Moonraker.History.HistoryItemStatus) => STATUS[status] ?? { label: status, tone: 'neutral' as const }
</script>

{#if error}
  <p class="state error">{error}</p>
{:else if !history}
  <p class="state muted">Loading…</p>
{:else if history.jobs.length === 0}
  <p class="state muted">No prints yet.</p>
{:else}
  <ul class="list">
    {#each history.jobs as entry (entry.job_id)}
      {@const status = statusOf(entry.status)}
      <li class="row">
        <Thumbnail path={entry.filename} thumbnails={entry.metadata?.thumbnails} />
        <div class="text">
          <span class="title" title={entry.filename}>{jobTitle(entry.filename)}</span>
          <span class="meta">
            <Pill tone={status.tone}>{status.label}</Pill>
            <span class="num">{formatAgo(entry.start_time)}</span>
            <span class="num">{formatDuration(entry.print_duration)}</span>
            <span class="num">{(entry.filament_used / 1000).toFixed(2)} m</span>
          </span>
        </div>
        {#if entry.exists && entry.status !== 'in_progress' && entry.status !== 'printing'}
          <StartPrintButton filename={entry.filename} label="Reprint" />
        {/if}
      </li>
    {/each}
  </ul>
  {#if history.count > history.jobs.length}
    <div class="more">
      <Button variant="ghost" size="sm" onclick={() => { limit += PAGE }}>Show more</Button>
    </div>
  {/if}
{/if}

<style>
  .state { margin: var(--space-6) 0; text-align: center; font-size: var(--text-sm); }
  .state.error { color: var(--danger); }
  .list { list-style: none; margin: 0; padding: 0; }
  .list > li + li { border-top: 1px solid var(--border); }
  .row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; min-height: 72px; }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .title { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 2px var(--space-3); font-size: var(--text-xs); color: var(--text-muted); }
  .more { display: flex; justify-content: center; margin-top: var(--space-2); }
</style>

<script lang="ts">
  import { mdiDeleteOutline } from '@mdi/js'
  import type { Backup } from '../lib/config-files'
  import { deleteConfigFile, readConfigFile } from '../lib/moonraker/config-api'
  import { errorMessage } from '../lib/moonraker/errors'
  import { diffText } from '../lib/text-diff'
  import { formatBytes } from '../lib/files'
  import { toasts } from '../lib/toasts.svelte'
  import ConfirmButton from '../lib/ui/ConfirmButton.svelte'

  interface Props {
    file: string
    backups: Backup[]
    /** What's in the editor now, to diff against. */
    current: string
    onrestore: (backup: Backup, text: string) => Promise<void>
  }

  let { file, backups, current, onrestore }: Props = $props()

  const KEEP_KLIPPER = 5
  const KINDS: Record<Backup['kind'], string> = { app: 'Before save', klipper: 'SAVE_CONFIG', copy: 'Copy' }
  const when = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })

  let selected = $state<string | null>(null)
  let text = $state<string | null>(null)
  let loading = $state(false)

  $effect(() => {
    void file
    selected = null
    text = null
  })

  const open = async (backup: Backup) => {
    selected = backup.path
    text = null
    loading = true
    try {
      const loaded = await readConfigFile(backup.path)
      if (selected === backup.path) text = loaded
    } catch (error) {
      toasts.push(errorMessage(error), 'error')
    } finally {
      loading = false
    }
  }

  const diff = $derived(text == null ? null : diffText(text, current))
  const selectedBackup = $derived(backups.find(backup => backup.path === selected))
  const oldKlipper = $derived(backups.filter(backup => backup.kind === 'klipper').slice(KEEP_KLIPPER))

  const remove = async (paths: string[]) => {
    for (const path of paths) {
      try {
        await deleteConfigFile(path)
      } catch (error) {
        toasts.push(errorMessage(error), 'error')
        return
      }
    }
    if (selected && paths.includes(selected)) {
      selected = null
      text = null
    }
    toasts.push(`Deleted ${paths.length} backup${paths.length === 1 ? '' : 's'}`, 'success')
  }
</script>

<div class="backups">
  <div class="list">
    <div class="list-head">
      <span>{backups.length} backup{backups.length === 1 ? '' : 's'} of {file}</span>
      {#if oldKlipper.length > 0}
        <ConfirmButton
          label="Tidy up"
          confirmLabel="Delete {oldKlipper.length}?"
          confirmVariant="danger"
          variant="ghost"
          title="Delete SAVE_CONFIG backups older than the newest {KEEP_KLIPPER}"
          onconfirm={() => remove(oldKlipper.map(backup => backup.path))}
        />
      {/if}
    </div>
    {#if backups.length === 0}
      <p class="muted empty">No backups yet. One is taken every time you save.</p>
    {/if}
    <ul>
      {#each backups as backup (backup.path)}
        <li class:selected={backup.path === selected}>
          <button type="button" class="pick" onclick={() => open(backup)}>
            <span class="when">{when.format(backup.taken)}</span>
            <span class="meta"><span class="kind">{KINDS[backup.kind]}</span> · <span class="mono">{backup.path}</span> · {formatBytes(backup.size)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>

  <div class="detail">
    {#if !selectedBackup}
      <p class="muted empty">Pick a backup to see what changed since.</p>
    {:else if loading || !diff || text == null}
      <p class="muted empty">Loading…</p>
    {:else}
      <div class="detail-head">
        <span>
          <span class="added num">+{diff.added}</span>
          <span class="removed num">−{diff.removed}</span>
          lines from the backup to the editor
        </span>
        <div class="actions">
          <ConfirmButton
            label="Delete"
            confirmLabel="Delete backup?"
            confirmVariant="danger"
            variant="ghost"
            icon={mdiDeleteOutline}
            onconfirm={() => remove([selectedBackup.path])}
          />
          <ConfirmButton
            label="Restore this"
            confirmLabel="Replace {file}?"
            variant="outline"
            disabled={diff.added === 0 && diff.removed === 0}
            onconfirm={() => onrestore(selectedBackup, text ?? '')}
          />
        </div>
      </div>
      {#if diff.added === 0 && diff.removed === 0}
        <p class="muted empty">Identical to what's in the editor.</p>
      {:else}
        <pre class="diff mono">{#each diff.rows as row, index (index)}{#if row.type === 'skip'}<span class="skip">  ⋯ {row.count} unchanged line{row.count === 1 ? '' : 's'}</span>{:else}<span class={row.type}>{row.type === 'add' ? '+ ' : row.type === 'del' ? '− ' : '  '}{row.text}</span>{/if}
{/each}</pre>
      {/if}
      <p class="muted hint">"Restore this" backs up the current file first, then replaces it. Restart afterwards to apply.</p>
    {/if}
  </div>
</div>

<style>
  .backups { display: grid; grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); gap: var(--space-4); height: 100%; min-height: 0; }
  .list, .detail { display: flex; flex-direction: column; min-height: 0; }
  .list-head, .detail-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); min-height: 36px; font-size: var(--text-sm); color: var(--text-muted); }
  ul { list-style: none; margin: var(--space-2) 0 0; padding: 0; overflow-y: auto; }
  li + li { border-top: 1px solid var(--border); }
  .pick { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: var(--space-2) var(--space-3); border: 0; border-radius: var(--radius-sm); background: none; text-align: left; cursor: pointer; }
  .pick:hover { background: var(--control); }
  li.selected .pick { background: var(--accent-soft); }
  .when { font-size: var(--text-sm); font-weight: 600; }
  .meta { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kind { color: var(--text); }
  .empty { margin: var(--space-3) 0; font-size: var(--text-sm); }
  .actions { display: flex; gap: var(--space-2); }
  .added { color: var(--success); font-weight: 600; }
  .removed { color: var(--danger); font-weight: 600; margin-right: var(--space-1); }
  .diff {
    flex: 1;
    min-height: 0;
    margin: var(--space-2) 0 0;
    padding: var(--space-3);
    overflow: auto;
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    font-size: 12px;
    line-height: 1.6;
  }
  .diff span { display: block; white-space: pre; }
  .diff .add { background: color-mix(in srgb, var(--success) 14%, transparent); color: var(--text); }
  .diff .del { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--text); }
  .diff .same { color: var(--text-muted); }
  .diff .skip { color: var(--text-faint); font-style: italic; }
  .hint { margin: var(--space-2) 0 0; font-size: var(--text-xs); }

  @media (max-width: 900px) {
    .backups { grid-template-columns: minmax(0, 1fr); }
    ul { max-height: 240px; }
  }
</style>

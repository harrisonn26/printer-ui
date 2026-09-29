<script lang="ts">
  import { mdiChevronRight, mdiFolderOutline } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { formatAgo, formatBytes } from '../lib/files'
  import { formatDuration, jobTitle } from '../lib/format'
  import { errorMessage } from '../lib/moonraker/errors'
  import Icon from '../lib/ui/Icon.svelte'
  import Thumbnail from '../lib/ui/Thumbnail.svelte'
  import StartPrintButton from './StartPrintButton.svelte'

  let { query = '' }: { query?: string } = $props()

  const GCODE = /\.(gcode|g|gco|bgcode)$/i

  let folder = $state('')
  let listing = $state.raw<Moonraker.Files.GetDirectoryResponse | null>(null)
  let error = $state<string | null>(null)

  $effect(() => {
    void session.filesRevision
    const path = folder ? `gcodes/${folder}` : 'gcodes'
    let current = true
    session.call<Moonraker.Files.GetDirectoryResponse>('server.files.get_directory', { path, extended: true })
      .then(response => {
        if (!current) return
        listing = response
        error = null
      })
      .catch(e => {
        if (current) error = errorMessage(e)
      })
    return () => { current = false }
  })

  const needle = $derived(query.trim().toLowerCase())

  const dirs = $derived((listing?.dirs ?? [])
    .filter(dir => !dir.dirname.startsWith('.'))
    .filter(dir => !needle || dir.dirname.toLowerCase().includes(needle))
    .sort((a, b) => a.dirname.localeCompare(b.dirname)))

  const files = $derived((listing?.files ?? [])
    .filter(file => GCODE.test(file.filename))
    .filter(file => !needle || file.filename.toLowerCase().includes(needle))
    .sort((a, b) => Number(b.modified) - Number(a.modified)))

  const pathOf = (filename: string) => (folder ? `${folder}/${filename}` : filename)
  const parent = $derived(folder.includes('/') ? folder.slice(0, folder.lastIndexOf('/')) : '')

  const meta = (file: Moonraker.Files.File | Moonraker.Files.FileWithMeta): string[] => {
    const parts: string[] = []
    if ('estimated_time' in file && file.estimated_time) parts.push(formatDuration(file.estimated_time))
    if ('filament_weight_total' in file && file.filament_weight_total) parts.push(`${file.filament_weight_total.toFixed(0)} g`)
    parts.push(formatBytes(file.size))
    parts.push(formatAgo(Number(file.modified)))
    return parts
  }

  const colour = (file: Moonraker.Files.File | Moonraker.Files.FileWithMeta) => (
    'filament_colors' in file ? file.filament_colors?.[0] : undefined
  )
</script>

{#if folder}
  <nav class="crumbs" aria-label="Folder">
    <button type="button" onclick={() => { folder = '' }}>Files</button>
    {#each folder.split('/') as part, index (index)}
      <Icon path={mdiChevronRight} size={16} />
      <button
        type="button"
        onclick={() => { folder = folder.split('/').slice(0, index + 1).join('/') }}
      >{part}</button>
    {/each}
  </nav>
{/if}

{#if error}
  <p class="state error">{error}</p>
{:else if !listing}
  <p class="state muted">Loading…</p>
{:else if dirs.length === 0 && files.length === 0}
  <p class="state muted">
    {needle ? `Nothing matches “${query.trim()}”.` : 'No G-code files yet. Upload from OrcaSlicer and they appear here.'}
  </p>
{:else}
  <ul class="list">
    {#if folder && !needle}
      <li>
        <button type="button" class="row dir" onclick={() => { folder = parent }}>
          <span class="folder"><Icon path={mdiFolderOutline} size={22} /></span>
          <span class="title">..</span>
        </button>
      </li>
    {/if}
    {#each dirs as dir (dir.dirname)}
      <li>
        <button type="button" class="row dir" onclick={() => { folder = pathOf(dir.dirname) }}>
          <span class="folder"><Icon path={mdiFolderOutline} size={22} /></span>
          <span class="title">{dir.dirname}</span>
          <Icon path={mdiChevronRight} size={18} />
        </button>
      </li>
    {/each}
    {#each files as file (file.filename)}
      {@const path = pathOf(file.filename)}
      <li class="row">
        <Thumbnail {path} thumbnails={'thumbnails' in file ? file.thumbnails : undefined} />
        <div class="text">
          <span class="title" title={file.filename}>{jobTitle(file.filename)}</span>
          <span class="meta">
            {#if colour(file)}<span class="swatch" style:background={colour(file)} aria-hidden="true"></span>{/if}
            {#if 'filament_type' in file && file.filament_type}<span>{file.filament_type}</span>{/if}
            {#each meta(file) as part (part)}<span>{part}</span>{/each}
          </span>
        </div>
        <StartPrintButton filename={path} />
      </li>
    {/each}
  </ul>
{/if}

<style>
  .crumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; margin-bottom: var(--space-2); color: var(--text-faint); }
  .crumbs button {
    padding: var(--space-1) var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-muted);
    font-size: var(--text-sm);
    cursor: pointer;
  }
  .crumbs button:hover { background: var(--control); color: var(--text); }
  .crumbs button:last-child { color: var(--text); }

  .state { margin: var(--space-6) 0; text-align: center; font-size: var(--text-sm); }
  .state.error { color: var(--danger); }

  .list { list-style: none; margin: 0; padding: 0; }
  .list > li + li { border-top: 1px solid var(--border); }
  .row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; min-height: 72px; }
  .dir {
    width: 100%;
    min-height: 56px;
    border: 0;
    background: none;
    color: var(--text-muted);
    text-align: left;
    cursor: pointer;
  }
  .dir:hover .title { color: var(--accent); }
  .folder { display: grid; place-items: center; width: 56px; color: var(--text-muted); }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .title { flex: 1; min-width: 0; color: var(--text); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { display: flex; flex-wrap: wrap; align-items: center; gap: 2px var(--space-3); font-size: var(--text-xs); color: var(--text-muted); }
  .meta span:not(.swatch) { font-family: var(--font-mono); }
  .meta span:first-of-type:not(.swatch) { font-family: inherit; }
  .swatch { width: 10px; height: 10px; border-radius: 50%; margin-right: -6px; box-shadow: 0 0 0 1px var(--border-strong); }
</style>

<script lang="ts">
  import { mdiContentSaveOutline, mdiHistory, mdiRestart } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { errorMessage } from '../lib/moonraker/errors'
  import { restartTarget, sortConfigFiles, type Backup, type ConfigTree } from '../lib/config-files'
  import {
    backupConfigFile,
    listConfigFiles,
    readConfigFile,
    writeConfigFile
  } from '../lib/moonraker/config-api'
  import { toasts } from '../lib/toasts.svelte'
  import Button from '../lib/ui/Button.svelte'
  import CodeEditor from '../components/CodeEditor.svelte'
  import ConfigBackups from '../components/ConfigBackups.svelte'
    import KlippyBanner from '../components/KlippyBanner.svelte';

  const RESTART_TIMEOUT_MS = 45_000

  let tree = $state.raw<ConfigTree>({ files: [], backups: new Map() })
  let listError = $state<string | null>(null)
  let path = $state<string | null>(null)
  let view = $state<'edit' | 'backups'>('edit')

  // Per file: the text as saved on the printer, and the editor's text.
  let saved = $state<Record<string, string>>({})
  let drafts = $state<Record<string, string>>({})
  let loading = $state(false)
  let saving = $state(false)
  let editor: CodeEditor | undefined = $state()

  /** A restart after saving: watch Klipper come back, or fail. */
  let restart = $state<null | {
    phase: 'restarting' | 'failed'
    file: string
    backup: string | null
    startedAt: number
    sawDown: boolean
    message?: string
  }>(null)

  // --- Files

  $effect(() => {
    void session.configRevision
    if (!session.ready) return
    listConfigFiles()
      .then(files => {
        tree = sortConfigFiles(files)
        listError = null
        if (!path || !tree.files.some(file => file.path === path)) path = tree.files[0]?.path ?? null
      })
      .catch(error => { listError = errorMessage(error) })
  })

  $effect(() => {
    const file = path
    if (!file || saved[file] !== undefined) return
    loading = true
    readConfigFile(file)
      .then(text => {
        saved[file] = text
        drafts[file] ??= text
      })
      .catch(error => toasts.push(errorMessage(error), 'error'))
      .finally(() => { loading = false })
  })

  const dirty = (file: string) => drafts[file] !== undefined && drafts[file] !== saved[file]
  const anyDirty = $derived(Object.keys(drafts).some(dirty))
  const current = $derived(path ? drafts[path] ?? saved[path] ?? '' : '')
  const backups = $derived(path ? tree.backups.get(path) ?? [] : [])
  const target = $derived(path ? restartTarget(path) : 'klipper')

  // Don't lose edits to a reload or a closed tab.
  $effect(() => {
    if (!anyDirty) return
    const guard = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  })

  // --- Saving

  const save = async (andRestart: boolean) => {
    const file = path
    if (!file || saving) return
    const text = drafts[file] ?? ''
    saving = true
    let backup: string | null = null
    try {
      backup = await backupConfigFile(file)
      await writeConfigFile(file, text)
      saved[file] = text
      toasts.push(`Saved ${file}`, 'success')
    } catch (error) {
      toasts.push(errorMessage(error), 'error')
      saving = false
      return
    }
    saving = false
    if (andRestart) await restartFor(file, backup)
  }

  const restartFor = async (file: string, backup: string | null) => {
    if (restartTarget(file) === 'moonraker') {
      // This printer's own Moonraker (hosts can run several); the connection
      // drops and comes back on its own.
      const service = session.system.info?.instance_ids?.moonraker
      if (!service) {
        toasts.push("Saved, but couldn't tell which Moonraker service to restart — restart it from the Machine page.", 'warning')
        return
      }
      await session.run('machine.services.restart', { service })
      return
    }
    restart = { phase: 'restarting', file, backup, startedAt: Date.now(), sawDown: false }
    await session.run('printer.restart')
  }

  // Klipper goes down, then comes back ready — or with the config error.
  $effect(() => {
    const state = session.klippy.state
    const watching = restart
    if (!watching || watching.phase !== 'restarting') return
    if (state !== 'ready' && state !== 'unknown') watching.sawDown = true
    if (state === 'error' || state === 'shutdown') {
      restart = { ...watching, phase: 'failed', message: session.klippy.message || `Klipper is ${state}` }
    } else if (state === 'ready' && (watching.sawDown || Date.now() - watching.startedAt > 8000)) {
      restart = null
      toasts.push('Klipper restarted with the new config', 'success')
    }
  })

  $effect(() => {
    if (restart?.phase !== 'restarting') return
    const timer = setTimeout(() => {
      if (restart?.phase === 'restarting') {
        restart = { ...restart, phase: 'failed', message: "Klipper didn't come back within 45 seconds." }
      }
    }, RESTART_TIMEOUT_MS)
    return () => clearTimeout(timer)
  })

  const revert = async () => {
    const failed = restart
    if (!failed?.backup) return
    try {
      const text = await readConfigFile(failed.backup)
      await writeConfigFile(failed.file, text)
      saved[failed.file] = text
      drafts[failed.file] = text
      editor?.reset(failed.file, text)
      toasts.push(`Reverted ${failed.file}`, 'success')
      await restartFor(failed.file, null)
    } catch (error) {
      toasts.push(errorMessage(error), 'error')
    }
  }

  const restore = async (backup: Backup, text: string) => {
    const file = path
    if (!file) return
    try {
      await backupConfigFile(file)
      await writeConfigFile(file, text)
      saved[file] = text
      drafts[file] = text
      editor?.reset(file, text)
      view = 'edit'
      toasts.push(`Restored ${file} from ${backup.path}. Restart to apply it.`, 'success')
    } catch (error) {
      toasts.push(errorMessage(error), 'error')
    }
  }

  const discard = () => {
    const text = path ? saved[path] : undefined
    if (!path || text === undefined) return
    drafts[path] = text
    editor?.reset(path, text)
  }

  const canRestart = $derived(session.ready && (target === 'moonraker' || !job.active))
</script>

{#if !session.klippyReady}
  <div class="klippy-banner"><KlippyBanner /></div>
{/if}

<section class="config">
  <aside class="files">
    <h1>Config</h1>
    {#if listError}<p class="error">{listError}</p>{/if}
    <ul>
      {#each tree.files as file (file.path)}
        {@const count = tree.backups.get(file.path)?.length ?? 0}
        <li>
          <button type="button" class:active={file.path === path} onclick={() => { path = file.path }}>
            <span class="name mono">{file.path}</span>
            {#if dirty(file.path)}<span class="dot" aria-label="Unsaved changes"></span>{/if}
            {#if count}<span class="count num" title="{count} backups">{count}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  </aside>

  <div class="main">
    {#if path}
      <header>
        <div class="title">
          <span class="mono path">{path}</span>
          {#if dirty(path)}<span class="unsaved">Unsaved</span>{/if}
        </div>
        <div class="actions">
          <Button
            variant={view === 'backups' ? 'secondary' : 'ghost'}
            size="sm"
            icon={mdiHistory}
            onclick={() => { view = view === 'backups' ? 'edit' : 'backups' }}
          >Backups{backups.length ? ` (${backups.length})` : ''}</Button>
          {#if dirty(path)}<Button variant="ghost" size="sm" onclick={discard}>Discard</Button>{/if}
          <Button
            size="sm"
            icon={mdiContentSaveOutline}
            disabled={!dirty(path) || !session.ready}
            loading={saving}
            onclick={() => save(false)}
          >Save</Button>
          <Button
            variant="primary"
            size="sm"
            icon={mdiRestart}
            disabled={!dirty(path) || !canRestart || saving}
            title={!canRestart && job.active ? 'Restarting Klipper would end the print — use Save' : `Saves, then restarts ${target === 'moonraker' ? 'Moonraker' : 'Klipper'}`}
            onclick={() => save(true)}
          >Save & restart</Button>
        </div>
      </header>

      {#if restart?.phase === 'restarting'}
        <div class="banner info" role="status">Restarting Klipper with {restart.file}…</div>
      {:else if restart?.phase === 'failed'}
        <div class="banner failed" role="alert">
          <div class="text">
            <strong>Klipper didn't accept {restart.file}</strong>
            <pre>{restart.message}</pre>
          </div>
          <div class="banner-actions">
            {#if restart.backup}<Button size="sm" variant="primary" onclick={revert}>Revert & restart</Button>{/if}
            <Button size="sm" variant="ghost" onclick={() => { restart = null }}>Keep editing</Button>
          </div>
        </div>
      {/if}

      <div class="body">
        {#if view === 'backups'}
          <ConfigBackups file={path} {backups} {current} onrestore={restore} />
        {:else if saved[path] === undefined}
          <p class="muted loading">{loading ? 'Loading…' : ''}</p>
        {:else}
          <CodeEditor
            bind:this={editor}
            docKey={path}
            initial={saved[path] ?? ''}
            onchange={(text) => { if (path) drafts[path] = text }}
            onsave={() => { if (path && dirty(path)) void save(false) }}
          />
        {/if}
      </div>
    {:else}
      <p class="muted loading">No config files found.</p>
    {/if}
  </div>
</section>

<style>
  .klippy-banner { margin-bottom: var(--space-4); }
  .config {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: var(--space-4);
    height: calc(100svh - 57px - var(--space-4) - var(--space-6));
  }
  .files, .main { min-height: 0; background: var(--surface); border-radius: var(--radius-lg); }
  .files { display: flex; flex-direction: column; padding: var(--space-4) var(--space-3); overflow-y: auto; }
  h1 { margin: 0 var(--space-2) var(--space-3); font-size: var(--text-sm); font-weight: 600; color: var(--text-muted); }
  .error { margin: 0 var(--space-2); color: var(--danger); font-size: var(--text-xs); }
  ul { list-style: none; margin: 0; padding: 0; }
  li button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    height: 36px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text-muted);
    text-align: left;
    cursor: pointer;
  }
  li button:hover { background: var(--control); color: var(--text); }
  li button.active { background: var(--accent-soft); color: var(--text); }
  .name { flex: 1; min-width: 0; font-size: var(--text-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dot { width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--warning); }
  .count { font-size: 11px; color: var(--text-faint); }

  .main { display: flex; flex-direction: column; overflow: hidden; }
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border); }
  .title { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
  .path { font-size: var(--text-sm); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .unsaved { font-size: var(--text-xs); font-weight: 600; color: var(--warning); }
  .actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }

  .banner { display: flex; align-items: flex-start; gap: var(--space-3); margin: var(--space-3) var(--space-4) 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); font-size: var(--text-sm); }
  .banner.info { background: var(--accent-soft); color: var(--text); }
  .banner.failed { background: var(--danger-bg); border: 1px solid var(--danger-border); }
  .banner .text { flex: 1; min-width: 0; }
  .banner strong { color: var(--danger); }
  .banner pre { margin: var(--space-1) 0 0; font-family: var(--font-mono); font-size: var(--text-xs); white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text); }
  .banner-actions { display: flex; flex-direction: column; gap: var(--space-2); }

  .body { flex: 1; min-height: 0; padding: var(--space-3) var(--space-4) var(--space-4); }
  .loading { margin: var(--space-6); text-align: center; font-size: var(--text-sm); }

  @media (max-width: 900px) {
    .config { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); height: auto; }
    .files { max-height: 200px; }
    .main { height: calc(100svh - 57px - var(--space-3) - 64px - 200px - var(--space-6)); min-height: 420px; }
  }
</style>

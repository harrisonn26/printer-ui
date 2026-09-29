<script lang="ts">
  import type { Snippet } from 'svelte'
  import { mdiCogOutline, mdiConsoleLine, mdiFileDocumentMultipleOutline, mdiPrinter3d, mdiTune } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { router, type Route } from '../lib/router.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Icon from '../lib/ui/Icon.svelte'
  import { toasts } from '../lib/toasts.svelte'

  let { children }: { children: Snippet } = $props()

  const NAV: { route: Route, label: string, icon: string }[] = [
    { route: '/', label: 'Print', icon: mdiPrinter3d },
    { route: '/jobs', label: 'Jobs', icon: mdiFileDocumentMultipleOutline },
    { route: '/console', label: 'Console', icon: mdiConsoleLine },
    { route: '/machine', label: 'Machine', icon: mdiTune },
    { route: '/settings', label: 'Settings', icon: mdiCogOutline }
  ]

  const host = $derived.by(() => {
    if (session.hostname) return session.hostname
    try { return new URL(session.url).hostname } catch { return 'Printer' }
  })

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
  const SHORTCUT_HINT = isMac ? '⌘⇧X' : 'Ctrl+Shift+X'

  let stopping = $state(false)

  // Never disabled while connected: if Klipper can't take it, Moonraker says so.
  const emergencyStop = async () => {
    if (stopping) return
    stopping = true
    const result = await session.run('printer.emergency_stop')
    stopping = false
    if (result !== undefined) toasts.push('Emergency stop sent', 'warning')
  }

  // Ctrl/⌘+Shift+X from anywhere, including while typing in a field.
  const onKeydown = (event: KeyboardEvent) => {
    if (event.code !== 'KeyX' || !event.shiftKey || !(event.ctrlKey || event.metaKey) || event.altKey) return
    event.preventDefault()
    if (!event.repeat) void emergencyStop()
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet links(variant: 'segmented' | 'tabs')}
  <nav class={variant} aria-label="Main">
    {#each NAV as item (item.route)}
      <a
        href={router.href(item.route)}
        class:active={router.current === item.route}
        aria-current={router.current === item.route ? 'page' : undefined}
      >
        {#if variant === 'tabs'}<Icon path={item.icon} size={20} />{/if}
        {item.label}
      </a>
    {/each}
  </nav>
{/snippet}

<div class="shell">
  <header>
    <span class="host">{host}</span>
    <div class="desktop-nav">{@render links('segmented')}</div>
    <Button
      variant="danger"
      size="sm"
      disabled={!session.ready}
      loading={stopping}
      title="Emergency stop ({SHORTCUT_HINT})"
      aria-keyshortcuts="Control+Shift+X Meta+Shift+X"
      onclick={emergencyStop}
    >Emergency stop<kbd>{SHORTCUT_HINT}</kbd></Button>
  </header>

  <main>
    {@render children()}
  </main>

  <div class="mobile-nav">{@render links('tabs')}</div>
</div>

<style>
  .shell { min-height: 100svh; display: flex; flex-direction: column; }

  /* Sticky, so the emergency stop is on screen however far the page scrolls. */
  header {
    position: sticky;
    top: 0;
    z-index: 20;
    height: 56px;
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-5);
    padding: 0 var(--space-6);
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px);
  }
  kbd {
    margin-left: var(--space-1);
    padding: 1px 5px;
    border: 1px solid var(--danger-border);
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    opacity: 0.85;
  }
  .host { font-weight: 700; }
  .desktop-nav { flex: 1; }

  .segmented {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: var(--surface);
  }
  .segmented a {
    padding: 6px 14px;
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-weight: 600;
    transition: background var(--transition), color var(--transition);
  }
  .segmented a:hover { color: var(--text); }
  .segmented a.active { background: var(--control); color: var(--text); }

  main {
    flex: 1;
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 0 var(--space-6) var(--space-6);
  }

  .mobile-nav { display: none; }

  @media (max-width: 760px) {
    header { padding: 0 var(--space-4); }
    kbd { display: none; }
    .host { flex: 1; }
    .desktop-nav { display: none; }
    main { padding: 0 var(--space-4) calc(64px + var(--space-4) + env(safe-area-inset-bottom)); }

    .mobile-nav {
      display: block;
      position: fixed;
      inset: auto 0 0;
      z-index: 10;
      padding-bottom: env(safe-area-inset-bottom);
      background: var(--surface-inset);
      border-top: 1px solid var(--border);
    }
    .tabs { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); height: 64px; }
    .tabs a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-1);
      color: var(--text-muted);
      font-size: 11px;
      font-weight: 600;
    }
    .tabs a.active { color: var(--accent); }
  }
</style>

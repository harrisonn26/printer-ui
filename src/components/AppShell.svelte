<script lang="ts">
  import type { Snippet } from 'svelte'
  import { mdiCogOutline, mdiOctagonOutline, mdiViewDashboardOutline } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { router, type Route } from '../lib/router.svelte'
  import { machineState } from '../lib/machine'
  import Button from '../lib/ui/Button.svelte'
  import Icon from '../lib/ui/Icon.svelte'
  import Pill from '../lib/ui/Pill.svelte'

  let { children }: { children: Snippet } = $props()

  const NAV: { route: Route, label: string, icon: string }[] = [
    { route: '/', label: 'Dashboard', icon: mdiViewDashboardOutline },
    { route: '/settings', label: 'Settings', icon: mdiCogOutline }
  ]

  const machine = $derived(machineState(
    session.status,
    session.klippy.state,
    session.printer.get('print_stats')?.state
  ))
</script>

<div class="shell">
  <header class="bar">
    <nav aria-label="Main">
      {#each NAV as item (item.route)}
        <a
          href={router.href(item.route)}
          class:active={router.current === item.route}
          aria-current={router.current === item.route ? 'page' : undefined}
        >
          <Icon path={item.icon} size={18} />
          <span class="label">{item.label}</span>
        </a>
      {/each}
    </nav>

    <div class="right">
      <Pill tone={machine.tone} pulse={machine.busy}>{machine.label}</Pill>
      <Button
        variant="danger"
        size="sm"
        icon={mdiOctagonOutline}
        disabled={!session.klippyReady}
        title="Emergency stop"
        onclick={() => session.run('printer.emergency_stop')}
      >Stop</Button>
    </div>
  </header>

  <main>
    {@render children()}
  </main>
</div>

<style>
  .shell { min-height: 100svh; display: flex; flex-direction: column; }
  .bar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    height: 52px;
    padding: 0 var(--space-4);
    background: color-mix(in srgb, var(--bg) 85%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
  }
  nav { display: flex; gap: var(--space-1); }
  nav a {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 34px;
    padding: 0 var(--space-3);
    border-radius: var(--radius-sm);
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-weight: 550;
    transition: background var(--transition), color var(--transition);
  }
  nav a:hover { background: var(--surface-3); color: var(--text); }
  nav a.active { background: var(--accent-soft); color: var(--accent); }
  .right { display: flex; align-items: center; gap: var(--space-2); }
  main { flex: 1; width: 100%; max-width: 1280px; margin: 0 auto; padding: var(--space-4); }

  @media (max-width: 600px) {
    .label { display: none; }
    main { padding: var(--space-3); }
  }
</style>

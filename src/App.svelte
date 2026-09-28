<script lang="ts">
  import { onMount } from 'svelte'
  import { session } from './lib/moonraker/session.svelte'
  import { router } from './lib/router.svelte'
  import AppShell from './components/AppShell.svelte'
  import Toasts from './lib/ui/Toasts.svelte'
  import Connecting from './views/Connecting.svelte'
  import Dashboard from './views/Dashboard.svelte'
  import Login from './views/Login.svelte'
  import Settings from './views/Settings.svelte'

  onMount(() => { void session.start() })
</script>

{#if session.status === 'ready'}
  <AppShell>
    {#if router.current === '/settings'}
      <Settings />
    {:else}
      <Dashboard />
    {/if}
  </AppShell>
{:else if session.status === 'authenticating'}
  <Login />
{:else if session.status === 'identifying'}
  <div class="loading muted">Loading…</div>
{:else}
  <Connecting />
{/if}

<Toasts />

<style>
  .loading { min-height: 100svh; display: grid; place-items: center; font-size: var(--text-sm); }
</style>

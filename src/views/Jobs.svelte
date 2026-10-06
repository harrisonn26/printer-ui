<script lang="ts">
  import { mdiMagnify } from '@mdi/js'
  import FileList from '../components/FileList.svelte'
  import HistoryList from '../components/HistoryList.svelte'
  import Icon from '../lib/ui/Icon.svelte'
  import Segmented from '../lib/ui/Segmented.svelte'
    import { session } from '../lib/moonraker/session.svelte';
    import KlippyBanner from '../components/KlippyBanner.svelte';

  const TABS = [
    { value: 'files', label: 'Files' },
    { value: 'history', label: 'History' }
  ] as const

  let tab = $state<'files' | 'history'>('files')
  let query = $state('')
</script>

{#if !session.klippyReady}
  <div class="banner"><KlippyBanner /></div>
{/if}

<section class="jobs">
  <header>
    <Segmented options={TABS} bind:value={tab} label="Jobs view" />
    {#if tab === 'files'}
      <label class="search">
        <Icon path={mdiMagnify} size={18} />
        <input type="search" bind:value={query} placeholder="Search files" aria-label="Search files" spellcheck="false" />
      </label>
    {/if}
  </header>

  {#if tab === 'files'}
    <FileList {query} />
  {:else}
    <HistoryList />
  {/if}
</section>

<style>
  .banner { margin-bottom: var(--space-4); }
  .jobs {
    max-width: 960px;
    margin: 0 auto;
    padding: var(--space-4) var(--space-5);
    background: var(--surface);
    border-radius: var(--radius-lg);
  }
  header { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
  header :global(.segmented) { width: 220px; }
  .search {
    flex: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 42px;
    padding: 0 var(--space-3);
    border-radius: 10px;
    background: var(--surface-inset);
    color: var(--text-muted);
  }
  .search input { flex: 1; min-width: 0; border: 0; background: none; color: var(--text); }
  .search input:focus { outline: none; }
  .search:focus-within { box-shadow: 0 0 0 2px var(--accent); }

  @media (max-width: 760px) {
    .jobs { padding: var(--space-3); }
    header { flex-direction: column; align-items: stretch; }
    header :global(.segmented) { width: auto; }
  }
</style>

<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import JobPanel from '../components/JobPanel.svelte'
  import KlippyBanner from '../components/KlippyBanner.svelte'
  import TemperaturesCard from '../components/TemperaturesCard.svelte'
</script>

{#if !session.klippyReady}
  <div class="banner"><KlippyBanner /></div>
{/if}

<div class="dashboard">
  <JobPanel />
  <aside class="rail">
    <TemperaturesCard />
  </aside>
</div>

<style>
  .banner { margin-bottom: var(--space-4); }
  .dashboard {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: var(--space-4);
    align-items: start;
  }
  .rail { display: flex; flex-direction: column; gap: var(--space-4); }
  @media (max-width: 1000px) {
    .dashboard { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
    .rail { gap: var(--space-3); }
  }
</style>

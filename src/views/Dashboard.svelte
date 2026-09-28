<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import KlippyBanner from '../components/KlippyBanner.svelte'
  import MachineCard from '../components/MachineCard.svelte'
  import PrintStatusCard from '../components/PrintStatusCard.svelte'
  import TemperaturesCard from '../components/TemperaturesCard.svelte'
</script>

<div class="dashboard">
  {#if !session.klippyReady}
    <div class="full"><KlippyBanner /></div>
  {/if}
  <div class="col">
    <PrintStatusCard />
    <TemperaturesCard />
  </div>
  <div class="col">
    <MachineCard />
  </div>
</div>

<style>
  .dashboard {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: var(--space-4);
    align-items: start;
  }
  .full { grid-column: 1 / -1; }
  .col { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
  @media (max-width: 900px) {
    .dashboard { grid-template-columns: minmax(0, 1fr); }
  }
</style>

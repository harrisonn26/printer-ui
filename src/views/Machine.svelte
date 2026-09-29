<script lang="ts">
  import BedMeshCard from '../components/BedMeshCard.svelte'
  import ConfigNoticesCard from '../components/ConfigNoticesCard.svelte'
  import HostCard from '../components/HostCard.svelte'
  import ServicesCard from '../components/ServicesCard.svelte'
  import UpdatesCard from '../components/UpdatesCard.svelte'
</script>

<div class="machine">
  <div class="notices"><ConfigNoticesCard /></div>
  <div class="col">
    <BedMeshCard />
    <UpdatesCard />
  </div>
  <div class="col">
    <HostCard />
    <ServicesCard />
  </div>
</div>

<style>
  .machine {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: var(--space-4);
    align-items: start;
  }
  .notices { grid-column: 1 / -1; }
  .notices:empty { display: none; }
  .col { display: flex; flex-direction: column; gap: var(--space-4); min-width: 0; }
  @media (max-width: 900px) {
    .machine { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
    .col { gap: var(--space-3); }
  }
</style>

<script lang="ts">
  import JobPanel from '../components/JobPanel.svelte'
  import MacrosCard from '../components/MacrosCard.svelte'
  import OutputsCard from '../components/OutputsCard.svelte'
  import TemperaturesCard from '../components/TemperaturesCard.svelte'
  import ThermalChart from '../components/ThermalChart.svelte'
  import ToolheadCard from '../components/ToolheadCard.svelte'
</script>

<div class="dashboard">
  <div class="job"><JobPanel /></div>
  <div class="chart"><ThermalChart /></div>
  <aside class="rail">
    <TemperaturesCard />
    <ToolheadCard />
    <OutputsCard />
    <MacrosCard />
  </aside>
</div>

<style>
  .dashboard {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'job rail'
      'chart rail';
    gap: var(--space-4);
    align-items: start;
  }
  .job { grid-area: job; min-width: 0; }
  .chart { grid-area: chart; min-width: 0; }
  .rail { grid-area: rail; display: flex; flex-direction: column; gap: var(--space-4); }
  /* Phones: controls before history. */
  @media (max-width: 1000px) {
    .dashboard {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: none;
      grid-template-areas: 'job' 'rail' 'chart';
      gap: var(--space-3);
    }
    .rail { gap: var(--space-3); }
  }
</style>

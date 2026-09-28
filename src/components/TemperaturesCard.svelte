<script lang="ts">
  import { mdiThermometer } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { formatTemp, prettyObjectName } from '../lib/format'
  import Card from '../lib/ui/Card.svelte'

  interface Row {
    key: string
    name: string
    temperature: number | undefined
    target: number | undefined
    power: number | undefined
  }

  const num = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined)

  const heaters = $derived(session.printer.get('heaters'))

  // available_sensors already includes the heaters; keep heaters first.
  const rows = $derived.by((): Row[] => {
    if (!heaters) return []
    const heaterKeys: string[] = heaters.available_heaters
    const keys = [...heaterKeys, ...heaters.available_sensors.filter(key => !heaterKeys.includes(key))]
    return keys.map(key => {
      const object = session.printer.raw(key)
      return {
        key,
        name: prettyObjectName(key),
        temperature: num(object?.temperature),
        target: num(object?.target),
        power: num(object?.power)
      }
    })
  })
</script>

<Card title="Temperatures" icon={mdiThermometer}>
  {#if rows.length === 0}
    <p class="muted empty">No temperature sensors reported.</p>
  {:else}
    <table>
      <thead>
        <tr><th scope="col">Sensor</th><th scope="col">Current</th><th scope="col">Target</th><th scope="col">Power</th></tr>
      </thead>
      <tbody>
        {#each rows as row (row.key)}
          <tr class:heating={(row.target ?? 0) > 0}>
            <th scope="row">{row.name}</th>
            <td class="num current">{formatTemp(row.temperature)}°</td>
            <td class="num">{row.target == null ? '' : row.target > 0 ? `${formatTemp(row.target)}°` : 'off'}</td>
            <td>
              {#if row.power != null}
                <div class="power" title="{Math.round(row.power * 100)}%">
                  <div class="bar" style:width="{row.power * 100}%"></div>
                </div>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</Card>

<style>
  .empty { margin: 0; font-size: var(--text-sm); }
  table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
  thead th {
    padding: 0 0 var(--space-2);
    text-align: left;
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
  }
  tbody th { text-align: left; font-weight: 500; padding: var(--space-2) 0; }
  td { padding: var(--space-2) 0; color: var(--text-muted); }
  tbody tr + tr { border-top: 1px solid var(--border); }
  .current { color: var(--text); font-weight: 600; }
  .heating .current { color: var(--heat); }
  .power { width: 64px; height: 4px; border-radius: 999px; background: var(--surface-3); overflow: hidden; }
  .bar { height: 100%; background: var(--heat); }
</style>

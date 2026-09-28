<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { formatTemp, prettyObjectName } from '../lib/format'
  import Card from '../lib/ui/Card.svelte'

  interface Row {
    key: string
    name: string
    temperature: number | undefined
    target: number | undefined
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
        name: prettyObjectName(key).replace(/^Extruder$/, 'Nozzle'),
        temperature: num(object?.temperature),
        target: num(object?.target)
      }
    })
  })
</script>

<Card title="Temperatures">
  {#if rows.length === 0}
    <p class="muted empty">No sensors reported.</p>
  {:else}
    <ul>
      {#each rows as row (row.key)}
        <li class:heating={(row.target ?? 0) > 0}>
          <span class="name">{row.name}</span>
          <span class="temp num">{formatTemp(row.temperature)}°</span>
          <span class="target num">
            {#if row.target != null}{row.target > 0 ? `→ ${Math.round(row.target)}` : 'off'}{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</Card>

<style>
  .empty { margin: 0; font-size: var(--text-sm); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: var(--space-3); height: 42px; }
  .name { flex: 1; min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .temp { font-size: 1.0625rem; }
  .heating .temp { color: var(--heat); }
  .target { width: 56px; text-align: right; font-size: var(--text-sm); color: var(--text-muted); }
</style>

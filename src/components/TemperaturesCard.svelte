<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { formatTemp, prettyObjectName } from '../lib/format'
  import { setTargetCommand, targetKind } from '../lib/gcode'
  import { sensorKeys, seriesVar } from '../lib/sensors'
  import { toasts } from '../lib/toasts.svelte'
  import { presetScript } from '../lib/moonraker/presets.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'

  interface Row {
    key: string
    name: string
    temperature: number | undefined
    target: number | undefined
    settable: boolean
    maxTemp: number | undefined
    colorVar: string
  }

  const num = (value: unknown): number | undefined => (typeof value === 'number' ? value : undefined)

  const heaters = $derived(session.printer.get('heaters'))
  const settings = $derived(session.printer.get('configfile')?.settings)

  const rows = $derived.by((): Row[] => {
    return sensorKeys(heaters).map((key, index) => {
      const object = session.printer.raw(key)
      return {
        key,
        name: prettyObjectName(key).replace(/^Extruder$/, 'Nozzle'),
        temperature: num(object?.temperature),
        target: num(object?.target),
        settable: targetKind(key) != null,
        maxTemp: num(settings?.[key.toLowerCase()]?.max_temp),
        colorVar: seriesVar(index)
      }
    })
  })

  const anyHeating = $derived(rows.some(row => (row.target ?? 0) > 0))
  const settableKeys = $derived(rows.filter(row => row.settable).map(row => row.key))

  const submit = async (row: Row, input: HTMLInputElement) => {
    const raw = input.value.trim()
    const target = raw === '' ? 0 : Number(raw)
    const revert = () => { input.value = row.target ? String(Math.round(row.target)) : '' }

    if (!Number.isFinite(target) || target < 0) {
      toasts.push(`${row.name}: enter a temperature in °C`, 'warning')
      revert()
      return
    }
    if (row.maxTemp != null && target > row.maxTemp) {
      toasts.push(`${row.name}: ${target}° is above its max_temp of ${row.maxTemp}°`, 'warning')
      revert()
      return
    }
    if (target === (row.target ?? 0)) return

    const command = setTargetCommand(row.key, target)
    if (command && !(await session.sendGcode(command))) revert()
  }

  const onKeydown = (row: Row, event: KeyboardEvent) => {
    const input = event.currentTarget as HTMLInputElement
    if (event.key === 'Enter') input.blur()
    if (event.key === 'Escape') {
      input.value = row.target ? String(Math.round(row.target)) : ''
      input.blur()
    }
  }
</script>

<Card title="Temperatures">
  {#snippet aside()}
    {#if anyHeating}
      <Button variant="ghost" size="sm" disabled={!session.klippyReady} onclick={() => session.sendGcode('TURN_OFF_HEATERS')}>All off</Button>
    {/if}
  {/snippet}

  {#if session.presets.list.length > 0 && settableKeys.length > 0}
    <div class="presets" role="group" aria-label="Temperature presets">
      {#each session.presets.list as preset (preset.id)}
        <Button
          variant="outline"
          size="sm"
          disabled={!session.klippyReady}
          title={Object.entries(preset.targets).map(([key, target]) => `${key} ${target}°`).join(', ')}
          onclick={() => {
            const script = presetScript(preset, settableKeys)
            if (script) void session.sendGcode(script)
          }}
        >{preset.name}</Button>
      {/each}
    </div>
  {/if}

  {#if rows.length === 0}
    <p class="muted empty">No sensors reported.</p>
  {:else}
    <ul>
      {#each rows as row (row.key)}
        <li class:heating={(row.target ?? 0) > 0}>
          <span class="key" style:background="var({row.colorVar})" aria-hidden="true"></span>
          <span class="name">{row.name}</span>
          <span class="temp num">{formatTemp(row.temperature)}°</span>
          {#if row.settable}
            <label class="target">
              <span class="arrow" aria-hidden="true">→</span>
              <input
                class="num"
                type="text"
                inputmode="numeric"
                aria-label="{row.name} target"
                placeholder="off"
                value={row.target ? Math.round(row.target) : ''}
                disabled={!session.klippyReady}
                onfocus={(event) => event.currentTarget.select()}
                onkeydown={(event) => onKeydown(row, event)}
                onchange={(event) => submit(row, event.currentTarget)}
              />
            </label>
          {:else}
            <span class="target"></span>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</Card>

<style>
  .empty { margin: 0; font-size: var(--text-sm); }
  .presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--space-2); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: var(--space-3); height: 42px; }
  .key { width: 14px; height: 3px; flex: none; border-radius: 2px; }
  .name { flex: 1; min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .temp { font-size: 1.0625rem; }
  .heating .temp { color: var(--heat); }
  .target { width: 72px; display: flex; align-items: center; justify-content: flex-end; gap: 2px; color: var(--text-muted); }
  .arrow { font-size: var(--text-sm); }
  input {
    width: 48px;
    height: 32px;
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-size: var(--text-sm);
    text-align: right;
    transition: background var(--transition), border-color var(--transition);
  }
  input::placeholder { color: var(--text-faint); }
  input:hover:not(:disabled) { background: var(--surface-inset); }
  input:focus { outline: none; border-color: var(--accent); background: var(--surface-inset); color: var(--text); }
  .heating input { color: var(--text); }
</style>

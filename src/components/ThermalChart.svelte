<script lang="ts">
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'
  import { untrack } from 'svelte'
  import { session } from '../lib/moonraker/session.svelte'
  import { targetColumn } from '../lib/moonraker/thermals.svelte'
  import { formatTemp, prettyObjectName } from '../lib/format'
  import { sensorKeys, seriesVar } from '../lib/sensors'
  import { theme } from '../lib/theme.svelte'
  import Card from '../lib/ui/Card.svelte'

  const HEIGHT = 240

  let container: HTMLDivElement | undefined = $state()
  let hoverIndex = $state<number | null>(null)
  let hidden = $state(new Set<string>())
  // Bumped when the OS colour scheme flips; canvas colours must be re-read.
  let schemeTick = $state(0)

  $effect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { schemeTick++ }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  })

  const keys = $derived(sensorKeys(session.printer.get('heaters')))

  interface Sensor {
    key: string
    name: string
    colorVar: string
    /** Target line drawn only when the heater was set at some point in the window. */
    hasTarget: boolean
  }

  const sensors = $derived.by((): Sensor[] => {
    void session.thermals.revision
    return keys.map((key, index) => ({
      key,
      name: prettyObjectName(key).replace(/^Extruder$/, 'Nozzle'),
      colorVar: seriesVar(index),
      hasTarget: (session.thermals.columns.get(targetColumn(key)) ?? []).some(value => (value ?? 0) > 0)
    }))
  })

  // What the chart's series are; a change rebuilds the chart, anything else is setData.
  const signature = $derived(sensors
    .map(sensor => `${sensor.key}:${sensor.hasTarget}:${hidden.has(sensor.key)}`)
    .join('|'))

  const buildData = (): uPlot.AlignedData => {
    const history = session.thermals
    const nulls = () => Array<null>(history.time.length).fill(null)
    const data: (number | null)[][] = [history.time.map(t => t / 1000)]
    for (const sensor of sensors) {
      data.push(history.columns.get(sensor.key) ?? nulls())
      if (sensor.hasTarget) data.push(history.columns.get(targetColumn(sensor.key)) ?? nulls())
    }
    return data as uPlot.AlignedData
  }

  const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  const withAlpha = (hex: string, alpha: number) => {
    const value = Number.parseInt(hex.replace('#', ''), 16)
    return `rgb(${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255} / ${alpha})`
  }

  const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
  const hoverFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  let chart: uPlot | null = null

  // Build (or rebuild) the chart when its series or colours change.
  $effect(() => {
    void signature
    void theme.choice
    void schemeTick
    const el = container
    if (!el) return

    const muted = cssVar('--text-muted')
    const grid = cssVar('--border')
    const font = `11px ${cssVar('--font-mono')}`

    const series: uPlot.Series[] = [{}]
    for (const sensor of untrack(() => sensors)) {
      const color = cssVar(sensor.colorVar)
      const show = !untrack(() => hidden).has(sensor.key)
      series.push({ label: sensor.name, stroke: color, width: 2, show, points: { show: false } })
      if (sensor.hasTarget) {
        series.push({
          label: `${sensor.name} target`,
          stroke: withAlpha(color, 0.55),
          width: 1.5,
          dash: [4, 4],
          show,
          points: { show: false }
        })
      }
    }

    const axis = (values: uPlot.Axis['values'], size?: number): uPlot.Axis => ({
      stroke: muted,
      font,
      size,
      grid: { stroke: grid, width: 1 },
      ticks: { show: false },
      values
    })

    const instance = new uPlot({
      width: el.clientWidth,
      height: HEIGHT,
      legend: { show: false },
      cursor: {
        y: false,
        drag: { x: false, y: false },
        points: { size: 8, width: 2 }
      },
      scales: {
        x: { time: true },
        y: { range: (_u, _min, max) => [0, Math.max(50, Math.ceil((max + 10) / 50) * 50)] }
      },
      axes: [
        axis((_u, splits) => splits.map(s => timeFormat.format(s * 1000))),
        axis((_u, splits) => splits.map(s => `${s}°`), 44)
      ],
      series,
      hooks: {
        setCursor: [u => { hoverIndex = u.cursor.idx ?? null }]
      }
    }, untrack(buildData), el)

    chart = instance
    const observer = new ResizeObserver(() => instance.setSize({ width: el.clientWidth, height: HEIGHT }))
    observer.observe(el)

    return () => {
      observer.disconnect()
      instance.destroy()
      chart = null
    }
  })

  // New samples: just swap the data.
  $effect(() => {
    void session.thermals.revision
    untrack(() => chart?.setData(buildData()))
  })

  const toggle = (key: string) => {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    hidden = next
  }

  const valueAt = (column: string, live: unknown): number | undefined => {
    if (hoverIndex != null) {
      const value = session.thermals.columns.get(column)?.[hoverIndex]
      return value ?? undefined
    }
    return typeof live === 'number' ? live : undefined
  }

  const hoverTime = $derived.by(() => {
    if (hoverIndex == null) return null
    const time = session.thermals.time[hoverIndex]
    return time == null ? null : hoverFormat.format(time)
  })
</script>

<Card title="Thermals">
  {#snippet aside()}
    <span class="num">{hoverTime ?? 'Last 20 min'}</span>
  {/snippet}

  <ul class="legend">
    {#each sensors as sensor (sensor.key)}
      {@const object = session.printer.raw(sensor.key)}
      {@const temperature = valueAt(sensor.key, object?.temperature)}
      {@const target = valueAt(targetColumn(sensor.key), object?.target)}
      <li>
        <button
          type="button"
          aria-pressed={!hidden.has(sensor.key)}
          class:off={hidden.has(sensor.key)}
          onclick={() => toggle(sensor.key)}
        >
          <span class="key" style:background="var({sensor.colorVar})"></span>
          <span class="name">{sensor.name}</span>
          <span class="value num">{formatTemp(temperature)}°</span>
          {#if sensor.hasTarget && target}<span class="target num">→ {Math.round(target)}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>

  <div class="plot" bind:this={container} role="img" aria-label="Temperature history for the last 20 minutes"></div>
</Card>

<style>
  .legend {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-2);
    margin: 0 0 var(--space-3);
    padding: 0;
  }
  .legend button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: 32px;
    padding: 0 var(--space-3) 0 var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: transparent;
    font-size: var(--text-sm);
    cursor: pointer;
    transition: opacity var(--transition), border-color var(--transition);
  }
  .legend button:hover { border-color: var(--border-strong); }
  .legend button.off { opacity: 0.45; }
  .key { width: 14px; height: 3px; border-radius: 2px; }
  .name { color: var(--text-muted); }
  .value { color: var(--text); }
  .target { color: var(--text-muted); font-size: var(--text-xs); }

  .plot { width: 100%; min-height: 240px; }
  .plot :global(.u-over) { cursor: crosshair; }
  .plot :global(.u-cursor-x) { border-right: 1px dashed var(--text-faint); }
</style>

<script lang="ts" module>
  import type { ParsedGcode } from '../lib/gcode-parse'

  // One file at a time: switching the stage to the camera and back shouldn't
  // re-download and re-parse it.
  let cache: { key: string, parsed: ParsedGcode } | null = null
</script>

<script lang="ts">
  import { untrack } from 'svelte'
  import { session } from '../lib/moonraker/session.svelte'
  import { job } from '../lib/moonraker/job.svelte'
  import { fileUrl } from '../lib/files'
  import { lastAtOrBefore, layerRange } from '../lib/gcode-parse'
  import type { ParseResponse } from '../workers/parse-gcode.worker'
  import Button from '../lib/ui/Button.svelte'

  const MAX_BYTES = 128 * 1024 * 1024
  /** Nominal extrusion width in mm, so infill reads as lines rather than a blob. */
  const LINE_WIDTH_MM = 0.45

  let canvas: HTMLCanvasElement | undefined = $state()
  let parsed = $state.raw<ParsedGcode | null>(null)
  let status = $state<'loading' | 'ready' | 'error' | 'too-large'>('loading')
  let error = $state('')
  /** Chosen with the scrubber; null follows the print. */
  let manualLayer = $state<number | null>(null)
  let liveLayer = $state(-1)

  const filename = $derived(job.filename)
  const filePosition = $derived(session.printer.get('virtual_sdcard')?.file_position ?? 0)
  const layerCount = $derived(parsed?.layerStart.length ?? 0)
  const layer = $derived(manualLayer ?? liveLayer)
  const animating = $derived(parsed != null && manualLayer == null && job.state === 'printing')

  // Download and parse in a worker whenever the job's file changes.
  // Only the filename and URL are dependencies; file_size changes with every
  // status update and must not restart the parse.
  $effect(() => {
    const file = filename
    const url = session.url
    if (!file || !url) return
    return untrack(() => load(file, url))
  })

  const load = (file: string, url: string): (() => void) | undefined => {
    manualLayer = null
    liveLayer = -1

    const size = session.printer.get('virtual_sdcard')?.file_size ?? 0
    if (size > MAX_BYTES) {
      parsed = null
      status = 'too-large'
      return
    }

    const key = `${url}|${file}`
    if (cache?.key === key) {
      parsed = cache.parsed
      status = 'ready'
      return
    }

    parsed = null
    status = 'loading'
    const worker = new Worker(new URL('../workers/parse-gcode.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<ParseResponse>) => {
      if (event.data.ok) {
        cache = { key, parsed: event.data.parsed }
        parsed = event.data.parsed
        status = 'ready'
      } else {
        error = event.data.error
        status = 'error'
      }
      worker.terminate()
    }
    worker.postMessage({ url: fileUrl(url, file) })
    return () => worker.terminate()
  }

  // --- Live front
  //
  // file_position arrives about once a second. Between samples the front is
  // extrapolated at the observed byte rate — a touch slow, capped at one
  // sample's worth, and forward-only, so the next real sample never drags it
  // back. (Matching motion_report's XY to the path was tried in fluidd-lite:
  // wherever a loop passes near its own start it snaps to the wrong place.)
  let lastPosition = 0
  let lastTime = 0
  let rate = 0
  let lastDelta = 0
  let shownPosition = 0

  $effect(() => {
    const position = filePosition
    const now = performance.now()
    if (position < lastPosition) {
      shownPosition = position
      rate = 0
      lastDelta = 0
    } else if (lastTime > 0 && position > lastPosition) {
      lastDelta = position - lastPosition
      const sampleRate = lastDelta / Math.max((now - lastTime) / 1000, 0.05)
      rate = rate > 0 ? rate * 0.6 + sampleRate * 0.4 : sampleRate
    }
    lastPosition = position
    lastTime = now
  })

  const frontPosition = (): number => {
    if (!animating || lastTime === 0) return filePosition
    const dt = Math.min((performance.now() - lastTime) / 1000, 1.5)
    const estimate = lastPosition + Math.min(rate * 0.9 * dt, lastDelta)
    if (estimate > shownPosition) shownPosition = estimate
    return Math.max(shownPosition, lastPosition)
  }

  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  const draw = () => {
    const p = parsed
    const el = canvas
    if (!el) return
    const dpr = window.devicePixelRatio || 1
    const width = el.clientWidth
    const height = el.clientHeight
    if (!width || !height) return
    if (el.width !== Math.round(width * dpr) || el.height !== Math.round(height * dpr)) {
      el.width = Math.round(width * dpr)
      el.height = Math.round(height * dpr)
    }
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (!p || p.x0.length === 0) return

    const position = frontPosition()
    const segment = lastAtOrBefore(p.byte, position)
    const live = segment < 0 ? 0 : lastAtOrBefore(p.layerStart, segment)
    if (live !== liveLayer) liveLayer = live
    const shown = manualLayer ?? live
    if (shown < 0) return

    // Scale to the whole model so the view doesn't jump between layers. The
    // top and bottom bands are left clear for the layer label and scrubber.
    const padX = 24
    const padTop = 48
    const padBottom = 72
    const modelWidth = Math.max(p.maxX - p.minX, 1)
    const modelHeight = Math.max(p.maxY - p.minY, 1)
    const scale = Math.min((width - padX * 2) / modelWidth, (height - padTop - padBottom) / modelHeight)
    const ox = (width - modelWidth * scale) / 2 - p.minX * scale
    const oy = padTop + (height - padTop - padBottom - modelHeight * scale) / 2 + p.maxY * scale
    const X = (v: number) => ox + v * scale
    const Y = (v: number) => oy - v * scale

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(0.6, LINE_WIDTH_MM * scale)

    const stroke = (from: number, to: number, colour: string, alpha: number) => {
      if (to <= from) return
      ctx.strokeStyle = colour
      ctx.globalAlpha = alpha
      ctx.beginPath()
      for (let i = from; i < to; i++) {
        ctx.moveTo(X(p.x0[i]!), Y(p.y0[i]!))
        ctx.lineTo(X(p.x1[i]!), Y(p.y1[i]!))
      }
      ctx.stroke()
    }

    const accent = css('--accent')
    const faint = css('--text-faint')

    // Excluded objects: outlined in red, dashed, so it's clear why they stop growing.
    const exclude = session.printer.get('exclude_object')
    if (exclude?.excluded_objects.length) {
      ctx.save()
      ctx.strokeStyle = css('--danger')
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      for (const object of exclude.objects) {
        if (!exclude.excluded_objects.includes(object.name) || !object.polygon?.length) continue
        ctx.beginPath()
        object.polygon.forEach(([px, py], index) => {
          if (index === 0) ctx.moveTo(X(px), Y(py))
          else ctx.lineTo(X(px), Y(py))
        })
        ctx.closePath()
        ctx.stroke()
      }
      ctx.restore()
    }

    // The layer below, for context.
    if (shown > 0) {
      const [from, to] = layerRange(p, shown - 1)
      stroke(from, to, faint, 0.12)
    }

    const [from, to] = layerRange(p, shown)
    stroke(from, to, faint, 0.45)

    // Printed part of the layer, with the front interpolated along its segment.
    const done = Math.min(Math.max(segment, from - 1), to - 1)
    if (done >= from) {
      stroke(from, done, accent, 1)
      const nextByte = p.byte[done + 1] ?? p.byte[done]! + 1
      const t = segment === done
        ? Math.min(1, Math.max(0, (position - p.byte[done]!) / Math.max(nextByte - p.byte[done]!, 1)))
        : 1
      const ax = p.x0[done]!, ay = p.y0[done]!
      const bx = ax + (p.x1[done]! - ax) * t
      const by = ay + (p.y1[done]! - ay) * t
      ctx.strokeStyle = accent
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.moveTo(X(ax), Y(ay))
      ctx.lineTo(X(bx), Y(by))
      ctx.stroke()

      if (segment >= from && segment < to && job.active) {
        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.arc(X(bx), Y(by), Math.max(3, ctx.lineWidth * 1.6), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  // Frame-rate loop while printing and visible; otherwise redraw on change.
  $effect(() => {
    void parsed
    void manualLayer
    void filePosition
    if (!animating) {
      untrack(draw)
      return
    }
    let frame = 0
    let stopped = false
    const loop = () => {
      if (stopped) return
      frame = requestAnimationFrame(loop)
      draw()
    }
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame)
        frame = 0
      } else if (!frame) {
        loop()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    if (!document.hidden) loop()
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  })

  $effect(() => {
    const el = canvas
    if (!el) return
    const observer = new ResizeObserver(() => untrack(draw))
    observer.observe(el)
    return () => observer.disconnect()
  })

  const onScrub = (event: Event) => {
    const value = Number((event.currentTarget as HTMLInputElement).value) - 1
    manualLayer = value === liveLayer ? null : value
  }
</script>

<div class="preview">
  <canvas bind:this={canvas} aria-label="Toolpath of the current layer"></canvas>

  {#if status === 'loading'}
    <p class="message muted">Reading the G-code…</p>
  {:else if status === 'error'}
    <p class="message error">No preview: {error}</p>
  {:else if status === 'too-large'}
    <p class="message muted">This file is too large to preview.</p>
  {:else if parsed && layerCount === 0}
    <p class="message muted">No extruding moves found in this file.</p>
  {/if}

  {#if parsed && layer >= 0}
    <span class="label num">
      Layer {layer + 1} / {layerCount} · Z {parsed.layerZ[layer]?.toFixed(2)}
    </span>
  {/if}

  {#if parsed && layerCount > 1}
    <div class="scrub">
      <input
        type="range"
        min="1"
        max={layerCount}
        value={layer + 1}
        aria-label="Layer"
        oninput={onScrub}
      />
      {#if job.active}
        <!-- Always laid out, so the slider doesn't shrink under the pointer when it appears. -->
        <span class="live" class:hidden={manualLayer == null} inert={manualLayer == null}>
          <Button size="sm" variant="secondary" onclick={() => { manualLayer = null }}>Live</Button>
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .preview { position: absolute; inset: 0; }
  canvas { width: 100%; height: 100%; display: block; }
  .message {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    padding: var(--space-4);
    text-align: center;
    font-size: var(--text-sm);
  }
  .message.error { color: var(--danger); }
  .label {
    position: absolute;
    left: var(--space-5);
    top: var(--space-5);
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .scrub {
    position: absolute;
    left: var(--space-5);
    bottom: var(--space-5);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: min(280px, 45%);
  }
  input[type='range'] { flex: 1; min-width: 0; accent-color: var(--accent); }
  .live.hidden { visibility: hidden; }

  @media (max-width: 760px) {
    .label { left: var(--space-3); top: var(--space-3); }
    .scrub { left: var(--space-3); bottom: var(--space-3); width: 45%; }
  }
</style>

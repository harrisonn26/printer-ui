<script lang="ts">
  import { mdiFullscreen, mdiVideoOffOutline } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { cameraMode, cameraTransform, resolveCameraUrl } from '../lib/camera'
  import Button from '../lib/ui/Button.svelte'
  import Icon from '../lib/ui/Icon.svelte'

  let { camera }: { camera: Moonraker.Webcam.Entry } = $props()

  const DEFAULT_FPS = 10
  const RETRY_MS = 3000

  let frame: HTMLDivElement | undefined = $state()
  let failed = $state(false)
  let snapshot = $state('')

  const mode = $derived(cameraMode(camera))
  const resolve = (url: string | undefined) => (url ? resolveCameraUrl(url, session.url, location.href) : '')
  const streamUrl = $derived(resolve(camera.stream_url))
  const snapshotUrl = $derived(resolve(camera.snapshot_url))
  const transform = $derived(cameraTransform(camera))
  const name = $derived(camera.name ?? 'Camera')

  // Adaptive MJPEG: fetch one snapshot, wait for it to load, then the next —
  // so a slow link lowers the frame rate instead of queueing requests.
  $effect(() => {
    if (mode !== 'snapshots' || !snapshotUrl) return
    const interval = 1000 / (camera.target_fps || DEFAULT_FPS)
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const next = () => {
      if (stopped) return
      if (document.hidden) {
        timer = setTimeout(next, 1000)
        return
      }
      const url = new URL(snapshotUrl)
      url.searchParams.set('_t', String(Date.now()))
      const image = new Image()
      image.onload = () => {
        if (stopped) return
        failed = false
        snapshot = image.src
        timer = setTimeout(next, interval)
      }
      image.onerror = () => {
        if (stopped) return
        failed = true
        timer = setTimeout(next, RETRY_MS)
      }
      image.src = url.toString()
    }
    next()

    return () => {
      stopped = true
      clearTimeout(timer)
    }
  })

  // Removing an <img> doesn't always close its MJPEG connection; blank it first.
  const closeOnDestroy = (image: HTMLImageElement) => () => { image.src = '' }

  const fullscreen = () => { void frame?.requestFullscreen?.() }
</script>

<div class="camera" bind:this={frame}>
  {#if mode === 'stream'}
    {#key streamUrl}
      <img
        src={streamUrl}
        alt="{name} live view"
        style:transform
        onerror={() => { failed = true }}
        onload={() => { failed = false }}
        {@attach closeOnDestroy}
      />
    {/key}
  {:else if mode === 'snapshots' && snapshot}
    <img src={snapshot} alt="{name} live view" style:transform />
  {:else if mode === 'iframe'}
    <iframe src={streamUrl} title="{name} live view"></iframe>
  {/if}

  {#if mode === 'unsupported'}
    <div class="message">
      <Icon path={mdiVideoOffOutline} size={28} />
      <p>{name} uses <span class="mono">{camera.service}</span>, which isn't supported yet.</p>
      {#if streamUrl}
        <a href={streamUrl} target="_blank" rel="noopener noreferrer">Open the stream in a new tab</a>
      {/if}
    </div>
  {:else if failed}
    <div class="message">
      <Icon path={mdiVideoOffOutline} size={28} />
      <p>Can't reach {name}.</p>
      <span class="muted mono url">{streamUrl || snapshotUrl}</span>
    </div>
  {/if}

  {#if mode !== 'unsupported'}
    <div class="controls">
      <Button variant="secondary" size="sm" icon={mdiFullscreen} aria-label="Full screen" onclick={fullscreen} />
    </div>
  {/if}
</div>

<style>
  .camera {
    position: relative;
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: #000;
  }
  img, iframe { width: 100%; height: 100%; object-fit: contain; border: 0; }
  .message {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-4);
    background: var(--surface-inset);
    color: var(--text-muted);
    text-align: center;
  }
  .message p { margin: 0; color: var(--text); }
  .url { font-size: var(--text-xs); overflow-wrap: anywhere; }
  .controls { position: absolute; top: var(--space-3); right: var(--space-3); opacity: 0.8; }
  .camera:fullscreen .controls { display: none; }
</style>

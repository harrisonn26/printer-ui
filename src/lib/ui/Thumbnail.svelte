<script lang="ts">
  import { mdiCubeOutline } from '@mdi/js'
  import { session } from '../moonraker/session.svelte'
  import { pickThumbnail, thumbnailUrl } from '../files'
  import Icon from './Icon.svelte'

  interface Props {
    /** The gcode's path within the gcodes root. */
    path: string
    thumbnails: Moonraker.Files.MetadataThumbnail[] | undefined
    size?: number
  }

  let { path, thumbnails, size = 56 }: Props = $props()

  let failed = $state(false)

  // Ask for twice the CSS size so it stays sharp on high-density screens.
  const thumbnail = $derived(pickThumbnail(thumbnails, size * 2))
  const src = $derived(thumbnail && session.url ? thumbnailUrl(session.url, path, thumbnail) : null)

  $effect(() => {
    void src
    failed = false
  })
</script>

<div class="thumb" style:width="{size}px" style:height="{size}px">
  {#if src && !failed}
    <img {src} alt="" loading="lazy" decoding="async" onerror={() => { failed = true }} />
  {:else}
    <Icon path={mdiCubeOutline} size={Math.round(size * 0.45)} />
  {/if}
</div>

<style>
  .thumb {
    flex: none;
    display: grid;
    place-items: center;
    border-radius: var(--radius-md);
    background: var(--surface-inset);
    color: var(--text-faint);
    overflow: hidden;
  }
  img { width: 100%; height: 100%; object-fit: contain; }
</style>

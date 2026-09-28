<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    /** 0–1 */
    value: number
    size?: number
    label: string
    children?: Snippet
  }

  let { value, size = 180, label, children }: Props = $props()

  const RADIUS = 44
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const dash = $derived(Math.min(Math.max(value, 0), 1) * CIRCUMFERENCE)
</script>

<div class="ring" style:width="{size}px" style:height="{size}px">
  <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
    <circle cx="50" cy="50" r={RADIUS} class="track" />
    <circle
      cx="50"
      cy="50"
      r={RADIUS}
      class="fill"
      stroke-dasharray="{dash} {CIRCUMFERENCE}"
      transform="rotate(-90 50 50)"
    />
  </svg>
  <div class="center">{@render children?.()}</div>
</div>

<style>
  .ring { position: relative; flex: none; }
  circle { fill: none; stroke-width: 7; }
  .track { stroke: var(--control); }
  .fill { stroke: var(--accent); stroke-linecap: round; transition: stroke-dasharray 400ms ease; }
  .center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
</style>

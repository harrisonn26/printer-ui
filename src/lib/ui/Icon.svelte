<script lang="ts">
  interface Props {
    path: string
    size?: number
    label?: string
  }

  let { path, size = 20, label }: Props = $props()
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  <path d={path} fill="currentColor" />
</svg>

<style>
  svg { flex: none; display: block; }
</style>

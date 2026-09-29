<script lang="ts">
  import { toasts } from '../toasts.svelte'

  interface Props {
    /** Current value from the printer; the field shows it until edited. */
    value: number | undefined
    label: string
    onsubmit: (value: number) => Promise<unknown> | unknown
    suffix?: string
    min?: number
    max?: number
    decimals?: number
    disabled?: boolean
    width?: string
  }

  let {
    value,
    label,
    onsubmit,
    suffix,
    min,
    max,
    decimals = 0,
    disabled = false,
    width = '64px'
  }: Props = $props()

  const format = (v: number | undefined) => (v == null || !Number.isFinite(v) ? '' : String(Number(v.toFixed(decimals))))

  let input: HTMLInputElement | undefined = $state()
  let focused = $state(false)

  // Follow the printer, except while the user is typing.
  $effect(() => {
    const text = format(value)
    if (input && !focused) input.value = text
  })

  const revert = () => { if (input) input.value = format(value) }

  const commit = async () => {
    if (!input) return
    const raw = input.value.trim()
    if (raw === '' || raw === format(value)) {
      revert()
      return
    }
    const next = Number(raw)
    if (!Number.isFinite(next) || (min != null && next < min) || (max != null && next > max)) {
      const range = min != null && max != null ? ` (${min}–${max})` : min != null ? ` (at least ${min})` : ''
      toasts.push(`${label}: enter a number${range}`, 'warning')
      revert()
      return
    }
    await onsubmit(next)
  }

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') input?.blur()
    if (event.key === 'Escape') {
      revert()
      input?.blur()
    }
  }
</script>

<label class="inline" style:--width={width}>
  <input
    bind:this={input}
    class="num"
    type="text"
    inputmode="decimal"
    aria-label={label}
    {disabled}
    onfocus={(event) => { focused = true; event.currentTarget.select() }}
    onblur={() => { focused = false }}
    onkeydown={onKeydown}
    onchange={commit}
  />
  {#if suffix}<span class="suffix">{suffix}</span>{/if}
</label>

<style>
  .inline { display: inline-flex; align-items: baseline; gap: 2px; }
  input {
    width: var(--width);
    height: 32px;
    padding: 0 var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: var(--surface-inset);
    color: var(--text);
    font-size: inherit;
    text-align: right;
    transition: border-color var(--transition);
  }
  input:hover:not(:disabled) { border-color: var(--border-strong); }
  input:focus { outline: none; border-color: var(--accent); }
  input:disabled { opacity: 0.6; }
  .suffix { font-size: var(--text-xs); color: var(--text-muted); }
</style>

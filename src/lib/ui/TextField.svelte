<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'

  interface Props extends HTMLInputAttributes {
    label: string
    value?: string
    hint?: string
    error?: string | null
  }

  let { label, value = $bindable(''), hint, error, id, ...rest }: Props = $props()

  const fieldId = $derived(id ?? `field-${label.toLowerCase().replace(/\W+/g, '-')}`)
</script>

<label class="field" for={fieldId}>
  <span class="label">{label}</span>
  <input
    id={fieldId}
    bind:value
    aria-invalid={error ? 'true' : undefined}
    aria-describedby={error || hint ? `${fieldId}-help` : undefined}
    {...rest}
  />
  {#if error}
    <span class="help error" id="{fieldId}-help">{error}</span>
  {:else if hint}
    <span class="help" id="{fieldId}-help">{hint}</span>
  {/if}
</label>

<style>
  .field { display: flex; flex-direction: column; gap: var(--space-1); }
  .label { font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); }
  input {
    height: var(--control-height);
    padding: 0 var(--space-3);
    background: var(--surface-inset);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    transition: border-color var(--transition);
  }
  input:hover { border-color: var(--border-strong); }
  input:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
  input[aria-invalid='true'] { border-color: var(--danger); }
  .help { font-size: var(--text-xs); color: var(--text-faint); }
  .help.error { color: var(--danger); }
</style>

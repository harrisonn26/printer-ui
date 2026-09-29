<script lang="ts" generics="T extends string | number">
  interface Props {
    options: readonly { value: T, label: string }[]
    value: T
    label: string
    size?: 'sm' | 'md'
    disabled?: boolean
  }

  let { options, value = $bindable(), label, size = 'md', disabled = false }: Props = $props()
</script>

<div class="segmented {size}" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === option.value}
      class:active={value === option.value}
      {disabled}
      onclick={() => { value = option.value }}
    >{option.label}</button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 10px;
    background: var(--surface-inset);
  }
  button {
    flex: 1;
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-muted);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--transition), color var(--transition);
  }
  .md button { height: 36px; padding: 0 var(--space-3); font-size: var(--text-sm); }
  .sm button { height: 28px; padding: 0 var(--space-2); font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 500; }
  button:hover:not(:disabled) { color: var(--text); }
  button.active { background: var(--control); color: var(--text); }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { mdiLoading } from '@mdi/js'
  import Icon from './Icon.svelte'

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
    size?: 'sm' | 'md'
    icon?: string
    loading?: boolean
    mono?: boolean
    children?: Snippet
  }

  let {
    variant = 'secondary',
    size = 'md',
    icon,
    loading = false,
    mono = false,
    disabled,
    type = 'button',
    class: className = '',
    children,
    ...rest
  }: Props = $props()
</script>

<button
  class="btn {variant} {size} {className}"
  class:mono
  class:icon-only={!children}
  {type}
  disabled={disabled || loading}
  aria-busy={loading}
  {...rest}
>
  {#if loading}
    <span class="spin"><Icon path={mdiLoading} size={size === 'sm' ? 16 : 18} /></span>
  {:else if icon}
    <Icon path={icon} size={size === 'sm' ? 16 : 18} />
  {/if}
  {@render children?.()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--transition), border-color var(--transition), color var(--transition);
  }
  .md { height: var(--control-height); padding: 0 var(--space-4); font-size: var(--text-md); }
  .sm { height: 36px; padding: 0 var(--space-3); font-size: var(--text-sm); border-radius: var(--radius-sm); }
  .md.icon-only { width: var(--control-height); padding: 0; }
  .sm.icon-only { width: 36px; padding: 0; }
  .mono { font-family: var(--font-mono); font-weight: 500; font-size: var(--text-xs); }

  .primary { background: var(--accent); color: var(--on-accent); }
  .primary:hover:not(:disabled) { background: var(--accent-hover); }

  .secondary { background: var(--control); }
  .secondary:hover:not(:disabled) { background: var(--control-hover); }

  .ghost { background: transparent; color: var(--text-muted); }
  .ghost:hover:not(:disabled) { background: var(--control); color: var(--text); }

  .outline { background: transparent; border-color: var(--border-strong); }
  .outline:hover:not(:disabled) { background: var(--control); }

  .danger { background: var(--danger-bg); border-color: var(--danger-border); color: var(--danger); }
  .danger:hover:not(:disabled) { border-color: var(--danger); }

  .btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .spin { display: inline-flex; animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>

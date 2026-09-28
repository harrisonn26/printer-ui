<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import { mdiLoading } from '@mdi/js'
  import Icon from './Icon.svelte'

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md'
    icon?: string
    loading?: boolean
    children?: Snippet
  }

  let {
    variant = 'secondary',
    size = 'md',
    icon,
    loading = false,
    disabled,
    type = 'button',
    children,
    ...rest
  }: Props = $props()
</script>

<button
  class="btn {variant} {size}"
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
    border-radius: var(--radius-sm);
    font-weight: 550;
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--transition), border-color var(--transition), color var(--transition);
  }
  .md { height: 36px; padding: 0 var(--space-4); font-size: var(--text-sm); }
  .sm { height: 28px; padding: 0 var(--space-3); font-size: var(--text-xs); }
  .md.icon-only { width: 36px; padding: 0; }
  .sm.icon-only { width: 28px; padding: 0; }

  .primary { background: var(--accent); color: var(--on-accent); }
  .primary:hover:not(:disabled) { background: var(--accent-hover); }

  .secondary { background: var(--surface-3); border-color: var(--border); }
  .secondary:hover:not(:disabled) { border-color: var(--border-strong); }

  .ghost { background: transparent; color: var(--text-muted); }
  .ghost:hover:not(:disabled) { background: var(--surface-3); color: var(--text); }

  .danger { background: var(--danger-soft); color: var(--danger); }
  .danger:hover:not(:disabled) { background: var(--danger); color: var(--on-accent); }

  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .spin { display: inline-flex; animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>

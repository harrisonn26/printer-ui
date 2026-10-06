<script lang="ts">
  import { mdiChevronDown, mdiLoading } from '@mdi/js'
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  export interface SplitOption {
    value: string
    label: string
    icon?: string
    danger?: boolean
    disabled?: boolean
  }

  interface Props {
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
    size?: 'sm' | 'md'
    icon?: string
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
    options: SplitOption[]
    value?: string
    menuLabel?: string
    align?: 'left' | 'right'
    children?: Snippet
    class?: string
    onclick?: (event: MouseEvent) => void
    onselect?: (option: SplitOption) => void
  }

  let {
    variant = 'secondary',
    size = 'md',
    icon,
    loading = false,
    disabled = false,
    type = 'button',
    options,
    menuLabel = 'More actions',
    align = 'right',
    children,
    class: className = '',
    onclick,
    onselect
  }: Props = $props()

  let open = $state(false)
  let root: HTMLDivElement | undefined = $state()

  $effect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (root && !root.contains(event.target as Node)) open = false
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') open = false
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  })

  const choose = (option: SplitOption) => {
    if (option.disabled) return
    open = false
    onselect?.(option)
  }

  const inactive = $derived(disabled || loading)
</script>

<div class="split {variant} {size} {className}" class:open bind:this={root}>
  <button
    class="main"
    {type}
    disabled={inactive}
    onclick={onclick}
    aria-busy={loading}
  >
    {#if loading}
      <span class="spin"><Icon path={mdiLoading} size={size === 'sm' ? 16 : 18} /></span>
    {:else if icon}
      <Icon path={icon} size={size === 'sm' ? 16 : 18} />
    {/if}
    {@render children?.()}
  </button>
  <span class="divider" aria-hidden="true"></span>
  <button
    class="toggle"
    type="button"
    disabled={inactive || options.length === 0}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label={menuLabel}
    title={menuLabel}
    onclick={() => { open = !open }}
  >
    <Icon path={mdiChevronDown} size={size === 'sm' ? 16 : 18} />
  </button>

  {#if open}
    <div class="menu" class:right={align === 'right'} role="menu">
      {#each options as option (option.value)}
        <button
          type="button"
          role="menuitem"
          class:danger={option.danger}
          disabled={option.disabled}
          onclick={() => choose(option)}
        >
          {#if option.icon}<Icon path={option.icon} size={16} />{/if}
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .split {
    position: relative;
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: stretch;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-weight: 700;
    white-space: nowrap;
    transition: background var(--transition), border-color var(--transition), color var(--transition);
  }
  .md { height: var(--control-height); font-size: var(--text-md); }
  .sm { height: 36px; font-size: var(--text-sm); border-radius: var(--radius-sm); }

  .main, .toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .main { flex: 1 1 auto; min-width: 0; padding: 0 var(--space-4); border-radius: var(--radius-md) 0 0 var(--radius-md); }
  .sm .main { padding: 0 var(--space-3); border-radius: var(--radius-sm) 0 0 var(--radius-sm); }
  .toggle { flex: none; padding: 0 var(--space-2); border-radius: 0 var(--radius-md) var(--radius-md) 0; }
  .sm .toggle { border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }

  .divider { width: 1px; align-self: stretch; margin: 6px 0; background: currentColor; opacity: 0.25; }
  .open .toggle :global(svg) { transform: rotate(180deg); }
  .toggle :global(svg) { transition: transform var(--transition); }

  .primary { background: var(--accent); color: var(--on-accent); }
  .primary .main:hover:not(:disabled), .primary .toggle:hover:not(:disabled) { background: var(--accent-hover); }
  .secondary { background: var(--control); }
  .secondary .main:hover:not(:disabled), .secondary .toggle:hover:not(:disabled) { background: var(--control-hover); }
  .ghost { background: transparent; color: var(--text-muted); }
  .ghost .main:hover:not(:disabled), .ghost .toggle:hover:not(:disabled) { background: var(--control); color: var(--text); }
  .outline { background: transparent; border-color: var(--border-strong); }
  .outline .main:hover:not(:disabled), .outline .toggle:hover:not(:disabled) { background: var(--control); }
  .danger { background: var(--danger-bg); border-color: var(--danger-border); color: var(--danger); }
  .danger .main:hover:not(:disabled), .danger .toggle:hover:not(:disabled) { background: var(--danger-bg); }

  .split:has(:disabled) { opacity: 0.45; }
  .main:disabled, .toggle:disabled { cursor: not-allowed; }

  .spin { display: inline-flex; animation: spin 0.9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    min-width: 100%;
    padding: var(--space-1);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
    color: var(--text);
    font-weight: 500;
  }
  .menu.right { left: auto; right: 0; }
  .menu button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    min-height: 38px;
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: inherit;
    font-size: var(--text-sm);
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
  }
  .menu button:hover:not(:disabled) { background: var(--control); }
  .menu button:disabled { opacity: 0.45; cursor: not-allowed; }
  .menu button.danger { color: var(--danger); }
</style>

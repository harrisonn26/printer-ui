<script lang="ts">
  import { mdiCheck, mdiChevronDown } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { printers, printerLabel } from '../lib/printers.svelte'
  import { router } from '../lib/router.svelte'
  import Icon from '../lib/ui/Icon.svelte'

  let open = $state(false)
  let root: HTMLDivElement | undefined = $state()

  const label = $derived(printers.active ? printerLabel(printers.active, session.hostname) : 'Printer')
  const many = $derived(printers.list.length > 1)

  $effect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (root && !root.contains(event.target as Node)) open = false
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') open = false }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  })

  const choose = (id: string) => {
    open = false
    session.switchTo(id)
  }
</script>

<div class="switcher" bind:this={root}>
  {#if many}
    <button
      type="button"
      class="trigger"
      aria-haspopup="menu"
      aria-expanded={open}
      onclick={() => { open = !open }}
    >
      <span>{label}</span>
      <Icon path={mdiChevronDown} size={18} />
    </button>
    {#if open}
      <div class="menu" role="menu">
        {#each printers.list as entry (entry.id)}
          {@const active = entry.id === printers.active?.id}
          <button type="button" role="menuitemradio" aria-checked={active} onclick={() => choose(entry.id)}>
            <span class="check">{#if active}<Icon path={mdiCheck} size={16} />{/if}</span>
            <span class="name">{printerLabel(entry, active ? session.hostname : null)}</span>
          </button>
        {/each}
        <a role="menuitem" href={router.href('/settings')} onclick={() => { open = false }}>Manage printers</a>
      </div>
    {/if}
  {:else}
    <span class="single">{label}</span>
  {/if}
</div>

<style>
  .switcher { position: relative; }
  .single, .trigger { font-weight: 700; white-space: nowrap; }
  .trigger {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: 36px;
    margin-left: calc(-1 * var(--space-2));
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    cursor: pointer;
  }
  .trigger:hover, .trigger[aria-expanded='true'] { background: var(--control); }
  .menu {
    position: absolute;
    top: calc(100% + 6px);
    left: calc(-1 * var(--space-2));
    z-index: 30;
    min-width: 220px;
    padding: var(--space-1);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
  }
  .menu button, .menu a {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    height: 38px;
    padding: 0 var(--space-3) 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text);
    font-size: var(--text-sm);
    text-align: left;
    cursor: pointer;
  }
  .menu button:hover, .menu a:hover { background: var(--control); }
  .menu a { margin-top: var(--space-1); padding-left: 34px; border-top: 1px solid var(--border); border-radius: 0 0 var(--radius-sm) var(--radius-sm); color: var(--text-muted); }
  .check { width: 18px; display: inline-flex; color: var(--accent); }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>

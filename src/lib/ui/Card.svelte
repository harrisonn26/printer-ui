<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  interface Props {
    title?: string
    icon?: string
    actions?: Snippet
    children: Snippet
  }

  let { title, icon, actions, children }: Props = $props()
</script>

<section class="card">
  {#if title}
    <header>
      {#if icon}<span class="icon"><Icon path={icon} size={18} /></span>{/if}
      <h2>{title}</h2>
      {#if actions}<div class="actions">{@render actions()}</div>{/if}
    </header>
  {/if}
  <div class="body">
    {@render children()}
  </div>
</section>

<style>
  .card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    min-width: 0;
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border);
  }
  .icon { color: var(--text-muted); }
  h2 {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 600;
    letter-spacing: 0.01em;
  }
  .actions { margin-left: auto; display: flex; gap: var(--space-1); }
  .body { padding: var(--space-4); }
</style>

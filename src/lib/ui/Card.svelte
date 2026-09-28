<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title?: string
    aside?: Snippet
    children: Snippet
  }

  let { title, aside, children }: Props = $props()
</script>

<section class="card">
  {#if title}
    <header>
      <h2>{title}</h2>
      {#if aside}<div class="aside">{@render aside()}</div>{/if}
    </header>
  {/if}
  {@render children()}
</section>

<style>
  .card {
    background: var(--surface);
    border-radius: var(--radius-lg);
    padding: 18px var(--space-5);
    min-width: 0;
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }
  h2 { margin: 0; font-size: var(--text-sm); font-weight: 600; color: var(--text-muted); }
  .aside { font-size: var(--text-xs); color: var(--text-muted); }
</style>

<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import Card from '../lib/ui/Card.svelte'

  const host = $derived.by(() => {
    try { return new URL(session.url).host } catch { return session.url }
  })
</script>

<Card title="Printer">
  <dl>
    <div><dt>Address</dt><dd class="mono">{host}</dd></div>
    <div><dt>Moonraker</dt><dd class="mono">{session.server?.moonraker_version ?? '—'}</dd></div>
    <div><dt>Klipper</dt><dd>{session.klippy.state}</dd></div>
    {#if session.namedUser}<div><dt>User</dt><dd>{session.namedUser.username}</dd></div>{/if}
  </dl>
  {#if session.server?.warnings.length}
    <ul class="warnings">
      {#each session.server.warnings as warning (warning)}<li>{warning}</li>{/each}
    </ul>
  {/if}
</Card>

<style>
  dl { margin: 0; display: grid; gap: var(--space-2); font-size: var(--text-sm); }
  dl div { display: flex; justify-content: space-between; gap: var(--space-3); }
  dt { color: var(--text-muted); }
  dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
  .warnings {
    margin: var(--space-3) 0 0;
    padding: var(--space-2) var(--space-3) var(--space-2) var(--space-5);
    border-radius: var(--radius-sm);
    background: var(--warning-soft);
    color: var(--warning);
    font-size: var(--text-xs);
  }
</style>

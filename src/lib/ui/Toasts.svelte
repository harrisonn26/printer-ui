<script lang="ts">
  import { mdiClose } from '@mdi/js'
  import { toasts } from '../toasts.svelte'
  import Icon from './Icon.svelte'
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toasts.items as toast (toast.id)}
    <div class="toast {toast.kind}">
      <span class="message">{toast.message}</span>
      <button type="button" aria-label="Dismiss" onclick={() => toasts.dismiss(toast.id)}>
        <Icon path={mdiClose} size={16} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    bottom: var(--space-4);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: min(440px, calc(100vw - 2 * var(--space-4)));
    z-index: 100;
  }
  .toast {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background: var(--control);
    border-left: 3px solid var(--text-muted);
    border-radius: var(--radius-sm);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
    font-size: var(--text-sm);
  }
  .success { border-color: var(--success); }
  .warning { border-color: var(--warning); }
  .error { border-color: var(--danger); }
  .message { flex: 1; overflow-wrap: anywhere; }
  button {
    background: none;
    border: 0;
    padding: 0;
    color: var(--text-muted);
    cursor: pointer;
  }
</style>

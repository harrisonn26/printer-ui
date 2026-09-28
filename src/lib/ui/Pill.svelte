<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
    pulse?: boolean
    children: Snippet
  }

  let { tone = 'neutral', pulse = false, children }: Props = $props()
</script>

<span class="status {tone}">
  <span class="dot" class:pulse></span>
  {@render children()}
</span>

<style>
  .status {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
  .pulse { animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; } }

  .neutral { color: var(--text-muted); }
  .accent { color: var(--accent); }
  .success { color: var(--success); }
  .warning { color: var(--warning); }
  .danger { color: var(--danger); }
</style>

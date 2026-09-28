<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
    pulse?: boolean
    children: Snippet
  }

  let { tone = 'neutral', pulse = false, children }: Props = $props()
</script>

<span class="pill {tone}">
  <span class="dot" class:pulse></span>
  {@render children()}
</span>

<style>
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: capitalize;
    white-space: nowrap;
  }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .pulse { animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; } }

  .neutral { background: var(--surface-3); color: var(--text-muted); }
  .accent { background: var(--accent-soft); color: var(--accent); }
  .success { background: var(--success-soft); color: var(--success); }
  .warning { background: var(--warning-soft); color: var(--warning); }
  .danger { background: var(--danger-soft); color: var(--danger); }
</style>

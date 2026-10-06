<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { theme, type ThemeChoice } from '../lib/theme.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'
  import MachineCard from '../components/MachineCard.svelte'
  import PresetsEditor from '../components/PresetsEditor.svelte'
  import PrintersCard from '../components/PrintersCard.svelte'
    import KlippyBanner from '../components/KlippyBanner.svelte';

  const THEMES: { value: ThemeChoice, label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' }
  ]
</script>

{#if !session.klippyReady}
  <div class="banner"><KlippyBanner /></div>
{/if}

<div class="settings">
  <PrintersCard />

  <MachineCard />

  <PresetsEditor />

  <Card title="Appearance">
    <div class="segmented" role="radiogroup" aria-label="Theme">
      {#each THEMES as option (option.value)}
        <button
          type="button"
          role="radio"
          aria-checked={theme.choice === option.value}
          class:active={theme.choice === option.value}
          onclick={() => theme.set(option.value)}
        >{option.label}</button>
      {/each}
    </div>
  </Card>

  {#if session.namedUser}
    <Card title="Account">
      <div class="account">
        <span>Signed in as <strong>{session.namedUser.username}</strong></span>
        <Button onclick={() => session.logout()}>Sign out</Button>
      </div>
    </Card>
  {/if}

  <p class="about muted">printer-ui {__APP_VERSION__}</p>
</div>

<style>
  .banner { margin-bottom: var(--space-4); }
  .settings { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-4); }
  .segmented {
    display: inline-flex;
    padding: 3px;
    border-radius: var(--radius-md);
    background: var(--control);
  }
  .segmented button {
    height: 36px;
    padding: 0 var(--space-4);
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--text-muted);
    font-size: var(--text-sm);
    font-weight: 550;
    cursor: pointer;
  }
  .segmented button.active { background: var(--surface); color: var(--text);  }
  .account { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); font-size: var(--text-sm); }
  .about { text-align: center; font-size: var(--text-xs); }
</style>

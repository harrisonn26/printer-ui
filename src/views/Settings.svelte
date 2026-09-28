<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { theme, type ThemeChoice } from '../lib/theme.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'
  import MachineCard from '../components/MachineCard.svelte'
  import TextField from '../lib/ui/TextField.svelte'

  let url = $state(session.url)
  let error = $state<string | null>(null)

  const THEMES: { value: ThemeChoice, label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'dark', label: 'Dark' },
    { value: 'light', label: 'Light' }
  ]

  const connect = (event: SubmitEvent) => {
    event.preventDefault()
    error = session.connect(url, true) ? null : 'Not a valid address'
  }
</script>

<div class="settings">
  <Card title="Connection">
    <form onsubmit={connect}>
      <TextField
        label="Moonraker address"
        bind:value={url}
        {error}
        hint="Saved in this browser. Leave the deploy's config.json for the default."
        spellcheck="false"
      />
      <div class="row">
        <Button type="submit" variant="primary">Reconnect</Button>
      </div>
    </form>
  </Card>

  <MachineCard />

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
  .settings { max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-4); }
  form { display: flex; flex-direction: column; gap: var(--space-3); }
  .row { display: flex; gap: var(--space-2); }
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

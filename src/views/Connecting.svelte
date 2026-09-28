<script lang="ts">
  import { mdiLanConnect, mdiLanDisconnect } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Icon from '../lib/ui/Icon.svelte'
  import TextField from '../lib/ui/TextField.svelte'

  let url = $state('')
  let edited = $state(false)
  let error = $state<string | null>(null)

  // Track the resolved URL until the user starts typing their own.
  $effect(() => {
    if (!edited) url = session.url
  })

  const connecting = $derived(session.status === 'connecting' || session.status === 'initializing')

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    error = session.connect(url, true) ? null : 'Enter a host, e.g. 192.168.1.20 or printer.local:7125'
  }
</script>

<div class="screen">
  <div class="panel">
    <div class="icon" class:connecting>
      <Icon path={connecting ? mdiLanConnect : mdiLanDisconnect} size={28} />
    </div>

    {#if connecting}
      <h1>Connecting…</h1>
      <p class="muted mono">{session.url}</p>
      {#if session.retry}
        <p class="muted">
          Attempt {session.retry.attempt} failed — retrying in {Math.round(session.retry.delay / 1000)}s
        </p>
      {/if}
    {:else}
      <h1>Not connected</h1>
      <p class="muted">Enter the address of your printer's Moonraker server.</p>
    {/if}

    <form onsubmit={submit}>
      <TextField
        label="Moonraker address"
        placeholder="printer.local:7125"
        bind:value={url}
        {error}
        autocomplete="url"
        oninput={() => { edited = true }}
        spellcheck="false"
      />
      <div class="row">
        <Button type="submit" variant="primary">Connect</Button>
        {#if connecting}
          <Button variant="ghost" onclick={() => session.disconnect()}>Stop</Button>
        {/if}
      </div>
    </form>
  </div>
</div>

<style>
  .screen { min-height: 100svh; display: grid; place-items: center; padding: var(--space-4); }
  .panel {
    width: min(400px, 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--space-2);
  }
  .icon {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--surface-3);
    color: var(--text-muted);
    margin-bottom: var(--space-2);
  }
  .icon.connecting { background: var(--accent-soft); color: var(--accent); animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.55; } }
  h1 { margin: 0; font-size: var(--text-xl); font-weight: 650; }
  p { margin: 0; font-size: var(--text-sm); overflow-wrap: anywhere; }
  form { width: 100%; margin-top: var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); text-align: left; }
  .row { display: flex; gap: var(--space-2); }
</style>

<script lang="ts">
  import { mdiLockOutline } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { errorMessage, isUnauthorizedError } from '../lib/moonraker/errors'
  import Button from '../lib/ui/Button.svelte'
  import Icon from '../lib/ui/Icon.svelte'
  import TextField from '../lib/ui/TextField.svelte'

  let username = $state('')
  let password = $state('')
  let source = $state(session.authInfo?.default_source ?? 'moonraker')
  let loading = $state(false)
  let error = $state<string | null>(null)

  const sources = $derived(session.authInfo?.available_sources ?? [])

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    loading = true
    error = null
    try {
      await session.login(username, password, source)
    } catch (e) {
      error = isUnauthorizedError(e) ? 'Incorrect username or password' : errorMessage(e)
    } finally {
      loading = false
    }
  }
</script>

<div class="screen">
  <form class="panel" onsubmit={submit}>
    <div class="icon"><Icon path={mdiLockOutline} size={26} /></div>
    <h1>Sign in</h1>
    <p class="muted mono">{session.url}</p>

    {#if error}<div class="error" role="alert">{error}</div>{/if}

    <TextField label="Username" bind:value={username} autocomplete="username" spellcheck="false" disabled={loading} />
    <TextField label="Password" type="password" bind:value={password} autocomplete="current-password" disabled={loading} />

    {#if sources.length > 1}
      <label class="source">
        <span>Source</span>
        <select bind:value={source} disabled={loading}>
          {#each sources as option (option)}<option value={option}>{option}</option>{/each}
        </select>
      </label>
    {/if}

    <Button type="submit" variant="primary" {loading}>Sign in</Button>
    <Button variant="ghost" onclick={() => session.disconnect()}>Use a different printer</Button>
  </form>
</div>

<style>
  .screen { min-height: 100svh; display: grid; place-items: center; padding: var(--space-4); }
  .panel { width: min(360px, 100%); display: flex; flex-direction: column; gap: var(--space-3); }
  .icon {
    align-self: center;
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
  }
  h1 { margin: 0; text-align: center; font-size: var(--text-xl); font-weight: 650; }
  p { margin: 0 0 var(--space-3); text-align: center; font-size: var(--text-sm); overflow-wrap: anywhere; }
  .error {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    background: var(--danger-soft);
    color: var(--danger);
    font-size: var(--text-sm);
  }
  .source { display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); }
  select {
    height: 38px;
    padding: 0 var(--space-2);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
</style>

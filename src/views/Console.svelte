<script lang="ts">
  import { tick } from 'svelte'
  import { mdiSend } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { commandSuggestions } from '../lib/gcode'
  import Button from '../lib/ui/Button.svelte'

  const HISTORY_LIMIT = 100

  let log: HTMLOListElement | undefined = $state()
  let command = $state('')
  let history: string[] = []
  let historyIndex = -1
  let stickToBottom = true

  const entries = $derived(session.console.entries)

  // Klipper's command list (macros included), fetched once per connection.
  let help = $state.raw<Record<string, string>>({})
  let selected = $state(0)
  // Opened by typing only, so a command recalled from history never traps the arrows.
  let suggesting = $state(false)

  $effect(() => {
    if (!session.klippyReady) return
    session.call<Record<string, string>>('printer.gcode.help')
      .then(response => { help = response })
      .catch(() => { help = {} })
  })

  const suggestions = $derived(suggesting ? commandSuggestions(help, command) : [])

  $effect(() => {
    void command
    selected = 0
  })

  const complete = (value: string) => {
    command = `${value} `
    suggesting = false
  }

  const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Open on the newest output.
  $effect(() => {
    if (log) log.scrollTop = log.scrollHeight
  })

  // Follow new output only while the user is already at the bottom.
  $effect.pre(() => {
    void entries.length
    if (!log) return
    stickToBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 24
    void tick().then(() => {
      if (stickToBottom && log) log.scrollTop = log.scrollHeight
    })
  })

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const script = command.trim()
    if (!script) return

    if (history.at(-1) !== script) history = [...history, script].slice(-HISTORY_LIMIT)
    historyIndex = -1
    command = ''
    suggesting = false
    stickToBottom = true
    await session.sendGcode(script)
  }

  const onKeydown = (event: KeyboardEvent) => {
    // With suggestions open, the arrows pick one and Tab or Enter takes it.
    if (suggestions.length > 0) {
      if (event.key === 'Tab' || event.key === 'Enter') {
        event.preventDefault()
        const pick = suggestions[selected] ?? suggestions[0]
        if (pick) complete(pick.command)
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        selected = (selected + step + suggestions.length) % suggestions.length
        return
      }
      if (event.key === 'Escape') {
        suggesting = false
        return
      }
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    if (history.length === 0) return
    event.preventDefault()

    if (event.key === 'ArrowUp') {
      historyIndex = historyIndex === -1 ? history.length - 1 : Math.max(historyIndex - 1, 0)
    } else if (historyIndex !== -1) {
      historyIndex = historyIndex + 1 >= history.length ? -1 : historyIndex + 1
    }
    command = historyIndex === -1 ? '' : history[historyIndex] ?? ''
    suggesting = false
  }
</script>

<section class="console">
  <header>
    <h1>Console</h1>
    <Button variant="ghost" size="sm" onclick={() => session.console.clear()}>Clear</Button>
  </header>

  <ol class="log mono" bind:this={log} aria-live="polite" aria-label="Console output">
    {#each entries as entry (entry.id)}
      <li class={entry.kind}>
        <time class="time">{time.format(entry.time)}</time>
        {#if entry.kind === 'command'}<span class="prompt" aria-hidden="true">&gt;</span>{/if}
        <span class="message">{entry.message}</span>
      </li>
    {:else}
      <li class="empty">Nothing yet. Klipper's responses show up here.</li>
    {/each}
  </ol>

  {#if suggestions.length > 0}
    <ul class="suggestions" role="listbox" aria-label="Matching commands">
      {#each suggestions as suggestion, index (suggestion.command)}
        <li role="option" aria-selected={index === selected}>
          <button
            type="button"
            class:selected={index === selected}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => complete(suggestion.command)}
          >
            <span class="mono command">{suggestion.command}</span>
            <span class="description">{suggestion.description}</span>
          </button>
        </li>
      {/each}
      <li class="hint" aria-hidden="true">Enter or Tab to complete · ↑↓ to choose · Esc to close</li>
    </ul>
  {/if}

  <form onsubmit={submit}>
    <span class="prompt mono" aria-hidden="true">&gt;</span>
    <input
      class="mono"
      bind:value={command}
      oninput={() => { suggesting = true; historyIndex = -1 }}
      onkeydown={onKeydown}
      placeholder="Send G-code…"
      aria-label="G-code command"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      disabled={!session.ready}
    />
    <Button type="submit" variant="primary" icon={mdiSend} aria-label="Send" disabled={!session.ready || !command.trim()} />
  </form>
</section>

<style>
  .console {
    position: relative;
    display: flex;
    flex-direction: column;
    /* Viewport minus the header (56px + border + gap) and the page's bottom padding. */
    height: calc(100svh - 57px - var(--space-4) - var(--space-6));
    background: var(--surface);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-5);
    border-bottom: 1px solid var(--border);
  }
  h1 { margin: 0; font-size: var(--text-sm); font-weight: 600; color: var(--text-muted); }

  .log {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    list-style: none;
    margin: 0;
    padding: var(--space-3) var(--space-5);
    background: var(--surface-inset);
    font-size: var(--text-sm);
    line-height: 1.7;
  }
  li { display: flex; gap: var(--space-3); }
  .time { flex: none; color: var(--text-faint); }
  .message { white-space: pre-wrap; overflow-wrap: anywhere; min-width: 0; }
  .prompt { color: var(--accent); }
  .command .message { color: var(--text); }
  .response .message { color: var(--text-muted); }
  .error .message { color: var(--danger); }
  .empty { color: var(--text-faint); font-family: var(--font-sans); }

  .suggestions {
    position: absolute;
    left: var(--space-3);
    right: var(--space-3);
    bottom: 72px;
    z-index: 2;
    list-style: none;
    margin: 0;
    padding: var(--space-1);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--surface);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.35);
  }
  .suggestions button {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .suggestions button.selected, .suggestions button:hover { background: var(--control); }
  .command { font-size: var(--text-sm); color: var(--text); white-space: nowrap; }
  .description { min-width: 0; font-size: var(--text-xs); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .suggestions .hint { padding: var(--space-1) var(--space-3) 2px; font-size: 11px; color: var(--text-faint); }

  form {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-3) var(--space-3) var(--space-5);
    border-top: 1px solid var(--border);
  }
  input {
    flex: 1;
    min-width: 0;
    height: var(--control-height);
    border: 0;
    background: transparent;
    font-size: var(--text-md);
  }
  input:focus { outline: none; }
  input::placeholder { color: var(--text-faint); }

  @media (max-width: 760px) {
    .console { height: calc(100svh - 57px - var(--space-3) - 64px - var(--space-4) - env(safe-area-inset-bottom)); }
    .log { padding: var(--space-3); font-size: var(--text-xs); }
    .time { display: none; }
    form { padding-left: var(--space-3); }
  }
</style>

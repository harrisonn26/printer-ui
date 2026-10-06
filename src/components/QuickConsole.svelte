<script lang="ts">
  import { tick } from 'svelte'
  import { session } from '../lib/moonraker/session.svelte'
  import { normalizeScript } from '../lib/moonraker/console.svelte'
  import { commandSuggestions } from '../lib/gcode'
  import { router } from '../lib/router.svelte'

  let open = $state(false)
  let command = $state('')
  let historyIndex = $state(-1)
  let selected = $state(0)
  let suggesting = $state(false)
  let input: HTMLInputElement | undefined = $state()
  let previousFocus: Element | null = $state(null)

  let help = $state.raw<Record<string, string>>({})
  let helpLoaded = $state(false)

  const history = $derived(session.console.history)
  const recent = $derived(session.console.entries.slice(-8).reverse())
  const suggestions = $derived(suggesting ? commandSuggestions(help, command) : [])

  $effect(() => {
    void command
    selected = 0
  })

  const loadHelp = () => {
    if (helpLoaded || !session.klippyReady) return
    helpLoaded = true
    session.call<Record<string, string>>('printer.gcode.help')
      .then((response) => { help = response })
      .catch(() => { help = {} })
  }

  const show = () => {
    if (!session.ready || open) return
    previousFocus = document.activeElement
    open = true
    command = ''
    historyIndex = -1
    suggesting = false
    loadHelp()
    void tick().then(() => input?.focus())
  }

  const hide = () => {
    open = false
    if (previousFocus instanceof HTMLElement) previousFocus.focus()
  }

  const send = async () => {
    const pick = suggestions[selected] ?? suggestions[0]
    // Tab-completion style: if a suggestion is highlighted, take it first.
    if (suggesting && pick && command.trim() && !command.includes(' ')) {
      command = `${pick.command} `
      suggesting = false
      return
    }
    const script = normalizeScript(command)
    if (!script) return
    historyIndex = -1
    command = ''
    suggesting = false
    await session.sendGcode(script, { typed: true })
  }

  // Ctrl/⌘+Shift+P from anywhere, including while typing in a field.
  const onWindowKeydown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey || event.repeat) return
    if (event.code !== 'KeyP') return
    if (open) return
    event.preventDefault()
    show()
  }

  const onInputKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (suggesting) suggesting = false
      else hide()
      return
    }
    if (suggestions.length > 0) {
      if (event.key === 'Tab') {
        event.preventDefault()
        const pick = suggestions[selected] ?? suggestions[0]
        if (pick) {
          command = `${pick.command} `
          suggesting = false
        }
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const step = event.key === 'ArrowDown' ? 1 : -1
        selected = (selected + step + suggestions.length) % suggestions.length
        return
      }
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      void send()
      return
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      // Typing opens suggestions; recalled history never traps the arrows.
      if (event.key.length === 1) suggesting = true
      return
    }
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

<svelte:window onkeydown={onWindowKeydown} />

{#if open}
  <div class="backdrop" onclick={hide} aria-hidden="true"></div>
  <div class="panel" role="dialog" aria-modal="true" aria-label="Quick console">
    <form
      onsubmit={(event) => {
        event.preventDefault()
        void send()
      }}
    >
      <input
        bind:this={input}
        bind:value={command}
        onkeydown={onInputKeydown}
        placeholder="Type a G-code command… (↵ send, esc close)"
        aria-label="G-code command"
        autocomplete="off"
        spellcheck="false"
      />
    </form>
    {#if suggestions.length > 0}
      <ul class="suggestions" role="listbox">
        {#each suggestions as item, i (item.command)}
          <li>
            <button
              type="button"
              role="option"
              aria-selected={i === selected}
              class:active={i === selected}
              onclick={() => {
                command = `${item.command} `
                suggesting = false
                input?.focus()
              }}
              onmousemove={() => { selected = i }}
            >
              <span class="mono">{item.command}</span>
              <span class="desc">{item.description}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if recent.length > 0}
      <ol class="recent mono">
        {#each recent as entry (entry.id)}
          <li class={entry.kind}>
            <span class="prefix">{entry.kind === 'command' ? '›' : entry.kind === 'error' ? '!!' : '·'}</span>
            <span>{entry.message.split('\n')[0]}</span>
          </li>
        {/each}
      </ol>
    {/if}
    <a href={router.href('/console')} onclick={hide}>Open full console</a>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgb(0 0 0 / 0.45);
  }
  .panel {
    position: fixed;
    top: 12vh;
    left: 50%;
    transform: translateX(-50%);
    z-index: 51;
    width: min(560px, calc(100vw - 2 * var(--space-4)));
    padding: var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    background: var(--surface);
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.45);
  }
  input {
    width: 100%;
    height: var(--control-height);
    padding: 0 var(--space-3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: var(--text-md);
  }
  input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  .suggestions {
    margin: var(--space-2) 0 0;
    padding: var(--space-1);
    list-style: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  .suggestions button {
    display: flex;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--text);
    font-size: var(--text-sm);
    text-align: left;
    cursor: pointer;
  }
  .suggestions button.active { background: var(--control); }
  .desc { overflow: hidden; color: var(--text-muted); text-overflow: ellipsis; white-space: nowrap; }
  .recent {
    margin: var(--space-2) 0 0;
    padding: 0;
    list-style: none;
    font-size: var(--text-xs);
    color: var(--text-muted);
  }
  .recent li { display: flex; gap: var(--space-2); padding: 2px 0; overflow: hidden; white-space: nowrap; }
  .recent .error { color: var(--danger); }
  .recent .command { color: var(--text); }
  .prefix { flex: none; width: 16px; }
  .panel a { display: inline-block; margin-top: var(--space-2); font-size: var(--text-xs); color: var(--accent); }
</style>

<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { macroCommand, macroParams, type MacroParam } from '../lib/gcode'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'

  interface Macro {
    name: string
    description: string | undefined
    params: MacroParam[]
  }

  // The job panel already owns these, and G/M-code overrides (M600, M109…)
  // aren't buttons people reach for.
  const HIDDEN = new Set(['PAUSE', 'RESUME', 'CANCEL_PRINT'])
  const GCODE_OVERRIDE = /^[GM]\d+$/i

  let open = $state<string | null>(null)
  let values = $state<Record<string, string>>({})
  let pending = $state<string | null>(null)

  const settings = $derived(session.printer.get('configfile')?.settings)

  const macros = $derived.by((): Macro[] => session.printer.keys()
    .filter(key => key.startsWith('gcode_macro '))
    .map(key => key.slice('gcode_macro '.length))
    .filter(name => !name.startsWith('_') && !HIDDEN.has(name.toUpperCase()) && !GCODE_OVERRIDE.test(name))
    .map(name => {
      const config = settings?.[`gcode_macro ${name.toLowerCase()}`]
      const template = typeof config?.gcode === 'string' ? config.gcode : ''
      const description = typeof config?.description === 'string' && config.description !== 'G-Code macro'
        ? config.description
        : undefined
      return { name: name.toUpperCase(), description, params: macroParams(template) }
    })
    .sort((a, b) => a.name.localeCompare(b.name)))

  const openMacro = $derived(macros.find(macro => macro.name === open))

  const run = async (macro: Macro, params: Record<string, string> = {}) => {
    pending = macro.name
    const ok = await session.sendGcode(macroCommand(macro.name, params))
    pending = null
    if (ok) open = null
  }

  const choose = (macro: Macro) => {
    if (macro.params.length === 0) {
      void run(macro)
      return
    }
    open = open === macro.name ? null : macro.name
    values = {}
  }

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (openMacro) void run(openMacro, values)
  }
</script>

<Card title="Macros">
  {#if macros.length === 0}
    <p class="muted empty">No macros configured.</p>
  {:else}
    <div class="chips">
      {#each macros as macro (macro.name)}
        <Button
          variant="outline"
          size="sm"
          mono
          class={open === macro.name ? 'open' : ''}
          title={macro.description}
          aria-expanded={macro.params.length ? open === macro.name : undefined}
          disabled={!session.klippyReady}
          loading={pending === macro.name}
          onclick={() => choose(macro)}
        >{macro.name}{#if macro.params.length}<span class="more" aria-hidden="true">…</span>{/if}</Button>
      {/each}
    </div>

    {#if openMacro}
      <form class="params" onsubmit={submit}>
        {#each openMacro.params as param (param.name)}
          <label>
            <span>{param.name}</span>
            <input
              class="num"
              bind:value={values[param.name]}
              placeholder={param.defaultValue || 'optional'}
              spellcheck="false"
            />
          </label>
        {/each}
        <div class="actions">
          <Button type="submit" variant="primary" size="sm" loading={pending === openMacro.name}>Run {openMacro.name}</Button>
          <Button variant="ghost" size="sm" onclick={() => { open = null }}>Close</Button>
        </div>
      </form>
    {/if}
  {/if}
</Card>

<style>
  .empty { margin: 0; font-size: var(--text-sm); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chips :global(.open) { border-color: var(--accent); color: var(--accent); }
  .more { margin-left: -4px; color: var(--text-muted); }
  .params {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
    margin-top: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--surface-inset);
  }
  label { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  label span { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); }
  input {
    height: 36px;
    padding: 0 var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    font-size: var(--text-sm);
  }
  input:focus { outline: none; border-color: var(--accent); }
  input::placeholder { color: var(--text-faint); }
  .actions { grid-column: 1 / -1; display: flex; gap: var(--space-2); margin-top: var(--space-1); }
</style>

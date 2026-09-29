<script lang="ts">
  import { mdiDeleteOutline, mdiPlus } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { errorMessage } from '../lib/moonraker/errors'
  import { newPresetId, type Preset } from '../lib/moonraker/presets.svelte'
  import { prettyObjectName } from '../lib/format'
  import { targetKind } from '../lib/gcode'
  import { sensorKeys } from '../lib/sensors'
  import { toasts } from '../lib/toasts.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'

  const heaters = $derived(sensorKeys(session.printer.get('heaters')).filter(key => targetKind(key) === 'heater'))

  // Edit a copy; nothing is written until Save.
  let draft = $state<Preset[]>([])
  let dirty = $state(false)
  let saving = $state(false)

  $effect(() => {
    const saved = session.presets.list
    if (!dirty) draft = saved.map(preset => ({ ...preset, targets: { ...preset.targets } }))
  })

  const heaterLabel = (key: string) => prettyObjectName(key).replace(/^Extruder$/, 'Nozzle')

  const edit = (fn: () => void) => {
    fn()
    dirty = true
  }

  const setTarget = (preset: Preset, key: string, raw: string) => edit(() => {
    const value = Number(raw)
    preset.targets[key] = raw.trim() === '' || !Number.isFinite(value) ? 0 : Math.max(0, Math.round(value))
  })

  const add = () => edit(() => {
    draft.push({ id: newPresetId(), name: 'New preset', targets: Object.fromEntries(heaters.map(key => [key, 0])) })
  })

  const remove = (id: string) => edit(() => { draft = draft.filter(preset => preset.id !== id) })

  const save = async () => {
    if (draft.some(preset => !preset.name.trim())) {
      toasts.push('Every preset needs a name', 'warning')
      return
    }
    saving = true
    try {
      await session.presets.save((method, params) => session.call(method, params), $state.snapshot(draft))
      dirty = false
      toasts.push('Presets saved', 'success')
    } catch (error) {
      toasts.push(errorMessage(error), 'error')
    } finally {
      saving = false
    }
  }

  const discard = () => {
    dirty = false
    draft = session.presets.list.map(preset => ({ ...preset, targets: { ...preset.targets } }))
  }
</script>

<Card title="Temperature presets">
  {#snippet aside()}
    <span>Saved on the printer</span>
  {/snippet}

  {#if draft.length === 0}
    <p class="muted empty">No presets.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th scope="col">Name</th>
          {#each heaters as key (key)}<th scope="col">{heaterLabel(key)} °C</th>{/each}
          <th scope="col"><span class="visually-hidden">Remove</span></th>
        </tr>
      </thead>
      <tbody>
        {#each draft as preset (preset.id)}
          <tr>
            <td>
              <input
                class="name"
                value={preset.name}
                aria-label="Preset name"
                oninput={(event) => edit(() => { preset.name = event.currentTarget.value })}
              />
            </td>
            {#each heaters as key (key)}
              <td>
                <input
                  class="num target"
                  inputmode="numeric"
                  value={preset.targets[key] || ''}
                  placeholder="off"
                  aria-label="{preset.name} {heaterLabel(key)} target"
                  onchange={(event) => setTarget(preset, key, event.currentTarget.value)}
                />
              </td>
            {/each}
            <td>
              <Button variant="ghost" size="sm" icon={mdiDeleteOutline} aria-label="Remove {preset.name}" onclick={() => remove(preset.id)} />
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <div class="actions">
    <Button variant="ghost" size="sm" icon={mdiPlus} onclick={add}>Add preset</Button>
    <span class="spacer"></span>
    {#if dirty}
      <Button variant="ghost" size="sm" onclick={discard}>Discard</Button>
    {/if}
    <Button variant="primary" size="sm" disabled={!dirty || !session.ready} loading={saving} onclick={save}>Save</Button>
  </div>
</Card>

<style>
  .empty { margin: 0 0 var(--space-3); font-size: var(--text-sm); }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 0 var(--space-2) var(--space-2) 0; text-align: left; font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); }
  td { padding: 3px var(--space-2) 3px 0; }
  input {
    height: 36px;
    padding: 0 var(--space-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-inset);
    font-size: var(--text-sm);
  }
  input:focus { outline: none; border-color: var(--accent); }
  input::placeholder { color: var(--text-faint); }
  .name { width: 100%; min-width: 100px; }
  .target { width: 72px; text-align: right; }
  .actions { display: flex; align-items: center; gap: var(--space-2); margin-top: var(--space-3); }
  .spacer { flex: 1; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>

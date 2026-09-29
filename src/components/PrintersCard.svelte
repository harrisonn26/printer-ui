<script lang="ts">
  import { mdiDeleteOutline, mdiPencilOutline, mdiPlus } from '@mdi/js'
  import { session } from '../lib/moonraker/session.svelte'
  import { printers, printerLabel, type PrinterEntry } from '../lib/printers.svelte'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'
  import TextField from '../lib/ui/TextField.svelte'

  const secure = location.protocol === 'https:'

  let adding = $state(false)
  let editing = $state<string | null>(null)
  let name = $state('')
  let address = $state('')
  let error = $state<string | null>(null)

  const host = (entry: PrinterEntry) => {
    try { return new URL(entry.url).host } catch { return entry.url }
  }

  const startAdd = () => {
    editing = null
    adding = true
    name = ''
    address = ''
    error = null
  }

  const startEdit = (entry: PrinterEntry) => {
    adding = false
    editing = entry.id
    name = entry.name
    address = host(entry)
    error = null
  }

  const close = () => {
    adding = false
    editing = null
    error = null
  }

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (adding) {
      if (!printers.add(name, address, secure)) {
        error = 'Enter a host, e.g. 192.168.0.140:7126'
        return
      }
    } else if (editing) {
      const wasActive = editing === printers.active?.id
      if (!printers.update(editing, { name, address }, secure)) {
        error = 'Enter a host, e.g. 192.168.0.140:7126'
        return
      }
      // Editing the connected printer's address reconnects to it.
      if (wasActive && printers.active && printers.active.url !== session.url) session.connect(printers.active.url)
    }
    close()
  }
</script>

<Card title="Printers">
  {#snippet aside()}
    <span>Saved in this browser</span>
  {/snippet}

  <ul>
    {#each printers.list as entry (entry.id)}
      {@const active = entry.id === printers.active?.id}
      <li class:active>
        <div class="text">
          <span class="name">{printerLabel(entry, active ? session.hostname : null)}</span>
          <span class="address mono">{host(entry)}</span>
        </div>
        {#if active}
          <span class="current">Connected</span>
        {:else}
          <Button size="sm" variant="outline" onclick={() => session.switchTo(entry.id)}>Switch</Button>
        {/if}
        <Button size="sm" variant="ghost" icon={mdiPencilOutline} aria-label="Edit {printerLabel(entry)}" onclick={() => startEdit(entry)} />
        {#if !active}
          <Button size="sm" variant="ghost" icon={mdiDeleteOutline} aria-label="Remove {printerLabel(entry)}" onclick={() => printers.remove(entry.id)} />
        {/if}
      </li>
    {/each}
  </ul>

  {#if adding || editing}
    <form onsubmit={submit}>
      <TextField label="Name" bind:value={name} placeholder="Ender 5" spellcheck="false" />
      <TextField label="Moonraker address" bind:value={address} {error} placeholder="192.168.0.140:7126" spellcheck="false" />
      <div class="row">
        <Button type="submit" variant="primary" size="sm">{adding ? 'Add printer' : 'Save'}</Button>
        <Button variant="ghost" size="sm" onclick={close}>Cancel</Button>
      </div>
    </form>
  {:else}
    <div class="row">
      <Button variant="ghost" size="sm" icon={mdiPlus} onclick={startAdd}>Add printer</Button>
    </div>
  {/if}
</Card>

<style>
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: var(--space-2); min-height: 56px; }
  li + li { border-top: 1px solid var(--border); }
  .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .name { font-weight: 600; font-size: var(--text-sm); }
  .address { font-size: var(--text-xs); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .current { font-size: var(--text-xs); font-weight: 600; color: var(--success); padding: 0 var(--space-2); }
  form { display: flex; flex-direction: column; gap: var(--space-3); margin-top: var(--space-3); }
  .row { display: flex; gap: var(--space-2); margin-top: var(--space-2); }
</style>

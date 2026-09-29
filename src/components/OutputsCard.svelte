<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import {
    fanCommand,
    hexToRgb,
    ledCommand,
    listOutputs,
    pinCommand,
    rgbToHex,
    type Output
  } from '../lib/outputs'
  import Button from '../lib/ui/Button.svelte'
  import Card from '../lib/ui/Card.svelte'

  const outputs = $derived(listOutputs(
    session.printer.keys(),
    key => session.printer.raw(key),
    session.printer.get('configfile')?.settings
  ))

  const percent = (value: number) => (value > 0 ? `${Math.round(value * 100)}%` : 'Off')

  // Sliders send on release, not on every step, so dragging isn't a flood of G-code.
  const setLevel = (output: Output, event: Event) => {
    const fraction = Number((event.currentTarget as HTMLInputElement).value) / 100
    const command = output.kind === 'output_pin' ? pinCommand(output, fraction) : fanCommand(output, fraction)
    if (command) void session.sendGcode(command)
  }

  const setColor = (output: Output, event: Event) => {
    const rgb = hexToRgb((event.currentTarget as HTMLInputElement).value)
    void session.sendGcode(ledCommand(output, { ...rgb, w: output.color?.w ?? 0 }))
  }
</script>

{#if outputs.length > 0}
  <Card title="Fans & outputs">
    <ul>
      {#each outputs as output (output.key)}
        <li>
          <div class="head">
            <span class="name">{output.label}</span>
            <span class="value num">
              {#if output.kind === 'led'}
                {output.value > 0 ? 'On' : 'Off'}
              {:else if output.kind === 'output_pin' && !output.pwm}
                {output.value > 0 ? 'On' : 'Off'}
              {:else}
                {percent(output.value)}{#if output.rpm} · {Math.round(output.rpm)} rpm{/if}
              {/if}
            </span>
          </div>

          {#if !output.controllable}
            <div class="meter" aria-hidden="true"><div class="fill" style:width="{output.value * 100}%"></div></div>
          {:else if output.kind === 'led'}
            <div class="led">
              <input
                type="color"
                value={output.color ? rgbToHex(output.color) : '#000000'}
                aria-label="{output.label} colour"
                disabled={!session.klippyReady}
                onchange={(event) => setColor(output, event)}
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={!session.klippyReady || output.value === 0}
                onclick={() => session.sendGcode(ledCommand(output, { r: 0, g: 0, b: 0, w: 0 }))}
              >Off</Button>
            </div>
          {:else if output.kind === 'output_pin' && !output.pwm}
            <button
              type="button"
              role="switch"
              class="switch"
              aria-checked={output.value > 0}
              aria-label={output.label}
              disabled={!session.klippyReady}
              onclick={() => session.sendGcode(pinCommand(output, output.value > 0 ? 0 : 1))}
            ><span class="knob"></span></button>
          {:else}
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(output.value * 100)}
              aria-label="{output.label} speed"
              disabled={!session.klippyReady}
              onchange={(event) => setLevel(output, event)}
            />
          {/if}
        </li>
      {/each}
    </ul>
  </Card>
{/if}

<style>
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
  li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-1) var(--space-3); }
  .head { display: contents; }
  .name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .value { font-size: var(--text-sm); color: var(--text-muted); text-align: right; }
  li > :not(.head) { grid-column: 1 / -1; }

  input[type='range'] { width: 100%; accent-color: var(--accent); }
  .meter { height: 4px; border-radius: 999px; background: var(--control); overflow: hidden; }
  .fill { height: 100%; background: var(--text-faint); }

  .led { display: flex; align-items: center; gap: var(--space-2); }
  input[type='color'] {
    width: 56px;
    height: 32px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-inset);
    cursor: pointer;
  }

  .switch {
    justify-self: start;
    width: 44px;
    height: 26px;
    padding: 3px;
    border: 0;
    border-radius: 999px;
    background: var(--control);
    cursor: pointer;
    transition: background var(--transition);
  }
  .switch[aria-checked='true'] { background: var(--accent); }
  .switch:disabled { opacity: 0.45; cursor: not-allowed; }
  .knob {
    display: block;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--text);
    transition: transform var(--transition);
  }
  .switch[aria-checked='true'] .knob { transform: translateX(18px); background: var(--on-accent); }
</style>

<script lang="ts">
  import { session } from '../lib/moonraker/session.svelte'
  import { pressureAdvanceCommand, retractionCommand, velocityLimitCommand } from '../lib/gcode'
  import Card from '../lib/ui/Card.svelte'
  import InlineNumber from '../lib/ui/InlineNumber.svelte'

  // These are live-tuning values: they apply until Klipper restarts and are
  // safe to change mid-print, which is when they're usually wanted.
  const toolhead = $derived(session.printer.get('toolhead'))
  const extruderKey = $derived(toolhead?.extruder || 'extruder')
  const extruder = $derived(session.printer.raw(extruderKey))
  const retraction = $derived(session.printer.get('firmware_retraction'))
  const disabled = $derived(!session.klippyReady)

  const num = (value: unknown) => (typeof value === 'number' ? value : undefined)
  const send = (script: string) => session.sendGcode(script)
</script>

<Card title="Tuning">
  {#snippet aside()}
    <span>Until Klipper restarts</span>
  {/snippet}

  <section>
    <h3>Pressure advance</h3>
    <div class="fields">
      <label>
        <span>Advance</span>
        <InlineNumber
          value={num(extruder?.pressure_advance)}
          label="Pressure advance"
          min={0}
          max={2}
          decimals={4}
          width="80px"
          {disabled}
          onsubmit={(value) => send(pressureAdvanceCommand(extruderKey, { advance: value }))}
        />
      </label>
      <label>
        <span>Smooth time</span>
        <InlineNumber
          value={num(extruder?.smooth_time)}
          label="Pressure advance smooth time"
          suffix="s"
          min={0}
          max={0.2}
          decimals={3}
          width="72px"
          {disabled}
          onsubmit={(value) => send(pressureAdvanceCommand(extruderKey, { smoothTime: value }))}
        />
      </label>
    </div>
  </section>

  <section>
    <h3>Motion limits</h3>
    <div class="fields">
      <label>
        <span>Velocity</span>
        <InlineNumber
          value={toolhead?.max_velocity}
          label="Max velocity"
          suffix="mm/s"
          min={1}
          width="64px"
          {disabled}
          onsubmit={(value) => send(velocityLimitCommand({ velocity: value }))}
        />
      </label>
      <label>
        <span>Acceleration</span>
        <InlineNumber
          value={toolhead?.max_accel}
          label="Max acceleration"
          suffix="mm/s²"
          min={1}
          width="72px"
          {disabled}
          onsubmit={(value) => send(velocityLimitCommand({ accel: value }))}
        />
      </label>
      <label>
        <span>Square corner velocity</span>
        <InlineNumber
          value={toolhead?.square_corner_velocity}
          label="Square corner velocity"
          suffix="mm/s"
          min={0}
          decimals={1}
          width="56px"
          {disabled}
          onsubmit={(value) => send(velocityLimitCommand({ squareCornerVelocity: value }))}
        />
      </label>
      {#if toolhead?.minimum_cruise_ratio != null}
        <label>
          <span>Min cruise ratio</span>
          <InlineNumber
            value={toolhead.minimum_cruise_ratio}
            label="Minimum cruise ratio"
            min={0}
            max={0.99}
            decimals={2}
            width="56px"
            {disabled}
            onsubmit={(value) => send(velocityLimitCommand({ minimumCruiseRatio: value }))}
          />
        </label>
      {/if}
    </div>
  </section>

  {#if retraction}
    <section>
      <h3>Firmware retraction</h3>
      <div class="fields">
        <label>
          <span>Length</span>
          <InlineNumber value={retraction.retract_length} label="Retract length" suffix="mm" min={0} decimals={2} width="56px" {disabled}
            onsubmit={(value) => send(retractionCommand({ retractLength: value }))} />
        </label>
        <label>
          <span>Speed</span>
          <InlineNumber value={retraction.retract_speed} label="Retract speed" suffix="mm/s" min={1} width="56px" {disabled}
            onsubmit={(value) => send(retractionCommand({ retractSpeed: value }))} />
        </label>
        <label>
          <span>Extra unretract</span>
          <InlineNumber value={retraction.unretract_extra_length} label="Extra unretract length" suffix="mm" min={0} decimals={2} width="56px" {disabled}
            onsubmit={(value) => send(retractionCommand({ unretractExtraLength: value }))} />
        </label>
        <label>
          <span>Unretract speed</span>
          <InlineNumber value={retraction.unretract_speed} label="Unretract speed" suffix="mm/s" min={1} width="56px" {disabled}
            onsubmit={(value) => send(retractionCommand({ unretractSpeed: value }))} />
        </label>
      </div>
    </section>
  {/if}
</Card>

<style>
  section + section { margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--border); }
  h3 { margin: 0 0 var(--space-2); font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); }
  .fields { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-2) var(--space-5); }
  label { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); font-size: var(--text-sm); }
</style>

// The Klipper host's battery, as published by deploy/host-battery.py into
// Moonraker's database (printer-ui/host_battery) once a minute.

export interface HostBattery {
  capacity: number | null
  status: string
  /** Mains power connected. */
  ac: boolean
  /** When the reading was taken, ms. */
  time: number
  /** Older than STALE_MS: the reporter has stopped (or the host clock is off). */
  stale: boolean
  /** Running on the battery: a power cut, or unplugged. */
  onBattery: boolean
}

export const STALE_MS = 5 * 60 * 1000

export const parseHostBattery = (value: unknown, now = Date.now()): HostBattery | null => {
  if (value == null || typeof value !== 'object') return null
  const record: Record<string, unknown> = { ...value }
  const time = typeof record.time === 'number' ? record.time * 1000 : null
  if (time == null) return null
  const status = typeof record.status === 'string' ? record.status : 'Unknown'
  const ac = record.ac === true
  return {
    capacity: typeof record.capacity === 'number' ? record.capacity : null,
    status,
    ac,
    time,
    stale: now - time > STALE_MS,
    onBattery: !ac || status === 'Discharging'
  }
}

export const batteryLabel = (battery: HostBattery): string => {
  if (battery.onBattery) return 'On battery'
  if (battery.status === 'Full') return 'Full'
  if (battery.status === 'Charging') return 'Charging'
  return 'Plugged in'
}

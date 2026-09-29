/**
 * Temperature sensors in display order: heaters first, then the rest, as
 * Klipper lists them. Chart colours come from this order, so a sensor keeps
 * its colour for as long as the config does.
 */
export const sensorKeys = (heaters: Klipper.HeatersState | undefined): string[] => {
  if (!heaters) return []
  const heaterKeys: string[] = heaters.available_heaters
  return [...heaterKeys, ...heaters.available_sensors.filter(key => !heaterKeys.includes(key))]
}

export const SERIES_COUNT = 8

/** CSS custom property for a sensor's categorical colour (app.css --series-N). */
export const seriesVar = (index: number): string => `--series-${(index % SERIES_COUNT) + 1}`

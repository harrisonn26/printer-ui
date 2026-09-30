import { StringStream } from '@codemirror/language'
import { klipperConfig } from '../klipper-config-mode'

/** Tokens per line as [text, style] pairs, whitespace dropped. */
const tokenize = (source: string): [string, string | null][][] => {
  const state = klipperConfig.startState!(2)
  return source.split('\n').map(line => {
    const stream = new StringStream(line, 2, 2)
    const tokens: [string, string | null][] = []
    while (!stream.eol()) {
      const style = klipperConfig.token(stream, state)
      const text = stream.current()
      if (text.trim()) tokens.push([text, style])
      stream.start = stream.pos
    }
    return tokens
  })
}

describe('klipper config mode', () => {
  it('highlights sections, options and comments', () => {
    expect(tokenize('[stepper_x]\nstep_pin: PC2 # X\n# note')).toEqual([
      [['[stepper_x]', 'header']],
      [['step_pin', 'propertyName'], [':', 'operator'], ['P', 'string'], ['C', 'string'], ['2', 'number'], ['# X', 'comment']],
      [['# note', 'comment']]
    ])
  })

  it('treats indented lines after an option as G-code with Jinja', () => {
    const lines = tokenize('[gcode_macro START]\ngcode:\n  G28\n  M104 S{params.TEMP}')
    expect(lines[2]).toEqual([['G28', 'keyword']])
    expect(lines[3]![0]).toEqual(['M104', 'keyword'])
    expect(lines[3]).toContainEqual(['{params.TEMP}', 'meta'])
  })

  it('marks the SAVE_CONFIG block', () => {
    expect(tokenize('#*# [bed_mesh default]')).toEqual([[['#*# [bed_mesh default]', 'meta']]])
  })
})

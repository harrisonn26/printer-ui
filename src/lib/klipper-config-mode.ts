// A CodeMirror stream mode for Klipper config files: [sections], key: value
// options, # and ; comments, the #*# SAVE_CONFIG block, and indented
// continuation lines, highlighted as G-code with Klipper's single-brace Jinja
// ({ … } and {% … %}).

import type { StreamParser, StringStream } from '@codemirror/language'

interface State {
  /** Inside an option value that continues on indented lines (gcode: …). */
  inValue: boolean
  /** Where on the current line we are. */
  part: 'start' | 'indent' | 'key' | 'value'
  /** Nesting depth of { … } on this line. */
  braces: number
}

const COMMAND = /^[A-Za-z_][A-Za-z0-9_]*/
const NUMBER = /^-?\d+(\.\d+)?/

const valueToken = (stream: StringStream, state: State, gcode: boolean): string | null => {
  if (state.braces > 0 || stream.match('{')) {
    if (state.braces === 0) state.braces = 1
    // Inside Jinja: run to the matching close brace on this line.
    while (!stream.eol() && state.braces > 0) {
      const ch = stream.next()
      if (ch === '{') state.braces++
      else if (ch === '}') state.braces--
    }
    return 'meta'
  }
  if (stream.match(/^[#;].*/)) return 'comment'
  if (stream.match(NUMBER)) return 'number'
  if (gcode && stream.sol() === false && stream.match(COMMAND)) return null
  stream.next()
  return 'string'
}

export const klipperConfig: StreamParser<State> = {
  name: 'klipper-config',
  startState: () => ({ inValue: false, part: 'start', braces: 0 }),

  token (stream, state) {
    if (stream.sol()) {
      state.part = 'start'
      state.braces = 0
      if (stream.match(/^#\*#.*/)) {
        state.inValue = false
        return 'meta'
      }
      // Indentation is its own token, so the line's content starts clean.
      if (stream.eatSpace()) {
        state.part = 'indent'
        return null
      }
    }

    if (state.part === 'start' || state.part === 'indent') {
      const indented = state.part === 'indent'
      if (stream.match(/^[#;].*/)) return 'comment'
      if (indented && state.inValue) {
        state.part = 'value'
        // A continuation line: G-code, starting with its command.
        if (stream.match(COMMAND)) return 'keyword'
        return valueToken(stream, state, true)
      }
      if (stream.match(/^\[[^\]]*\]?/)) {
        state.inValue = false
        state.part = 'value'
        return 'header'
      }
      state.part = 'key'
      state.inValue = true
    }

    if (state.part === 'key') {
      if (stream.match(/^[^:=]+/)) return 'propertyName'
      if (stream.match(/^[:=]/)) {
        state.part = 'value'
        return 'operator'
      }
    }

    if (stream.eatSpace()) return null
    return valueToken(stream, state, false)
  }
}

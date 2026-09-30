import { ConsoleLog, appendHistory } from '../console.svelte'

describe('appendHistory', () => {
  it('keeps single-line commands without consecutive repeats', () => {
    let history: string[] = []
    for (const command of ['G28', 'G28', 'M104 S200', 'SAVE_GCODE_STATE NAME=x\nG1 X1', 'G28']) {
      history = appendHistory(history, command)
    }
    expect(history).toEqual(['G28', 'M104 S200', 'G28'])
  })

  it('caps the length', () => {
    expect(appendHistory(['a', 'b', 'c'], 'd', 3)).toEqual(['b', 'c', 'd'])
  })
})

describe('ConsoleLog history', () => {
  it('seeds from Moonraker, grows with sent commands and survives clear', () => {
    const log = new ConsoleLog()
    log.load([
      { message: 'G28', type: 'command', time: 1 },
      { message: 'ok', type: 'response', time: 2 },
      { message: 'BED_MESH_CALIBRATE', type: 'command', time: 3 }
    ])
    log.push('M105', 'command')
    log.push('ok T:200', 'response')
    log.clear()
    expect(log.history).toEqual(['G28', 'BED_MESH_CALIBRATE', 'M105'])
  })
})

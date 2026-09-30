import { appBackupPath, backupTarget, restartTarget, sortConfigFiles } from '../config-files'

// Names from the Ender 5's real config folder.
const entry = (path: string, modified = 1_790_000_000) => ({ path, size: 100, modified })
const tree = sortConfigFiles([
  'printer.cfg', 'fluidd.cfg', 'TEST_SPEED.cfg', 'moonraker.conf', '.moonraker.conf.bkp',
  'printer-20260930_131114.cfg', 'printer-20260929_170010.cfg',
  'printer.cfg.pre-bltouch', 'printer.cfg.bak-screwtilt', 'printer.cfg.kiauh',
  'moonraker.conf.bak-20260922_103056',
  '.printer-ui/backups/printer.cfg.20260930-141502'
].map(path => entry(path)))

describe('sortConfigFiles', () => {
  it('lists editable files, printer.cfg first and moonraker.conf last', () => {
    expect(tree.files.map(file => file.path)).toEqual(['printer.cfg', 'fluidd.cfg', 'TEST_SPEED.cfg', 'moonraker.conf'])
  })

  it("files every kind of backup under its original, newest first", () => {
    const printer = tree.backups.get('printer.cfg')!
    expect(printer.map(backup => backup.path)).toEqual(expect.arrayContaining([
      'printer-20260930_131114.cfg', 'printer-20260929_170010.cfg',
      'printer.cfg.pre-bltouch', 'printer.cfg.bak-screwtilt', 'printer.cfg.kiauh',
      '.printer-ui/backups/printer.cfg.20260930-141502'
    ]))
    expect(printer.find(b => b.path === 'printer-20260930_131114.cfg')?.kind).toBe('klipper')
    expect(printer.find(b => b.path.startsWith('.printer-ui'))?.kind).toBe('app')
    expect(printer[0]!.path).toBe('.printer-ui/backups/printer.cfg.20260930-141502')
    expect(tree.backups.get('moonraker.conf')!.map(b => b.path).sort())
      .toEqual(['.moonraker.conf.bkp', 'moonraker.conf.bak-20260922_103056'])
  })

  it('reads the time from Klipper and app backup names', () => {
    const klipper = tree.backups.get('printer.cfg')!.find(b => b.path === 'printer-20260930_131114.cfg')!
    expect(new Date(klipper.taken)).toEqual(new Date(2026, 8, 30, 13, 11, 14))
  })
})

describe('backupTarget', () => {
  it('leaves unrelated files alone', () => {
    expect(backupTarget('macros.cfg', new Set(['printer.cfg']))).toBeNull()
    expect(backupTarget('printer_old.cfg', new Set(['printer.cfg']))).toBeNull()
  })
})

describe('appBackupPath', () => {
  it('stamps the local time', () => {
    expect(appBackupPath('printer.cfg', new Date(2026, 8, 30, 14, 15, 2))).toBe('.printer-ui/backups/printer.cfg.20260930-141502')
  })
})

describe('restartTarget', () => {
  it('restarts Moonraker only for moonraker.conf', () => {
    expect(restartTarget('moonraker.conf')).toBe('moonraker')
    expect(restartTarget('printer.cfg')).toBe('klipper')
    expect(restartTarget('macros/moonraker.conf.cfg')).toBe('klipper')
  })
})

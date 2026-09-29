import { updateMethod, updateSummary } from '../system.svelte'

const git = (overrides: Record<string, unknown> = {}) => ({
  configured_type: 'git_repo',
  version: 'v0.13.0-756',
  remote_version: 'v0.13.0-777',
  commits_behind_count: 0,
  is_valid: true,
  is_dirty: false,
  corrupt: false,
  ...overrides
}) as unknown as Moonraker.UpdateManager.GitRepo

const web = (overrides: Record<string, unknown> = {}) => ({
  configured_type: 'web',
  version: 'v1.37.5',
  remote_version: 'v1.37.5',
  is_valid: true,
  ...overrides
}) as unknown as Moonraker.UpdateManager.NetHosted

describe('updateSummary', () => {
  it('counts commits behind for git repos', () => {
    expect(updateSummary(git({ commits_behind_count: 21 }))).toEqual({ state: 'available', detail: '21 commits behind' })
    expect(updateSummary(git({ commits_behind_count: 1 }))).toEqual({ state: 'available', detail: '1 commit behind' })
  })

  it('compares versions for web clients', () => {
    expect(updateSummary(web({ remote_version: 'v1.37.6' }))).toEqual({ state: 'available', detail: 'Update available' })
    expect(updateSummary(web())).toEqual({ state: 'current', detail: 'Up to date' })
  })

  it('counts system packages', () => {
    const system = { configured_type: 'system', package_count: 80, package_list: [] } as Moonraker.UpdateManager.System
    expect(updateSummary(system)).toEqual({ state: 'available', detail: '80 packages' })
  })

  it('flags broken installs before anything else', () => {
    expect(updateSummary(git({ is_dirty: true, commits_behind_count: 3 })).state).toBe('problem')
    expect(updateSummary(git({ is_valid: false })).detail).toBe('Invalid install')
  })
})

describe('updateMethod', () => {
  it('routes each component to its RPC', () => {
    expect(updateMethod('moonraker', git())).toEqual({ method: 'machine.update.moonraker' })
    expect(updateMethod('klipper', git())).toEqual({ method: 'machine.update.klipper', params: { include_deps: true } })
    expect(updateMethod('system', { configured_type: 'system', package_count: 1, package_list: [] })).toEqual({ method: 'machine.update.system' })
    expect(updateMethod('fluidd', web())).toEqual({ method: 'machine.update.client', params: { name: 'fluidd' } })
  })
})

// Reading and writing files in the Klipper config folder through Moonraker.

import { session } from './session.svelte'
import { httpBase } from '../files'
import { appBackupPath, type ConfigFile } from '../config-files'

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

export const listConfigFiles = async (): Promise<ConfigFile[]> => {
  const files = await session.call<Moonraker.Files.ListRootResponse>('server.files.list', { root: 'config' })
  return files.map(file => ({ path: file.path, size: file.size, modified: file.modified }))
}

export const readConfigFile = async (path: string): Promise<string> => {
  const response = await fetch(`${httpBase(session.url)}/server/files/config/${encodePath(path)}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Couldn't read ${path} (HTTP ${response.status})`)
  return response.text()
}

export const writeConfigFile = async (path: string, text: string): Promise<void> => {
  const slash = path.lastIndexOf('/')
  const form = new FormData()
  form.append('root', 'config')
  if (slash !== -1) form.append('path', path.slice(0, slash))
  form.append('file', new Blob([text], { type: 'text/plain' }), path.slice(slash + 1))
  const response = await fetch(`${httpBase(session.url)}/server/files/upload`, { method: 'POST', body: form })
  if (!response.ok) {
    let detail = `HTTP ${response.status}`
    try {
      const body: unknown = await response.json()
      if (body && typeof body === 'object' && 'error' in body && body.error && typeof body.error === 'object' && 'message' in body.error) {
        detail = String(body.error.message)
      }
    } catch {
      // Not JSON; keep the status.
    }
    throw new Error(`Couldn't save ${path}: ${detail}`)
  }
}

/** Create each folder along `dir`, ignoring the ones that exist. */
const ensureDirectory = async (dir: string): Promise<void> => {
  const parts = dir.split('/')
  for (let i = 1; i <= parts.length; i++) {
    try {
      await session.call('server.files.post_directory', { path: `config/${parts.slice(0, i).join('/')}` })
    } catch {
      // Already there.
    }
  }
}

/** Copy the current file into the app's backups folder; returns the copy's path. */
export const backupConfigFile = async (path: string): Promise<string> => {
  const dest = appBackupPath(path)
  await ensureDirectory(dest.slice(0, dest.lastIndexOf('/')))
  await session.call('server.files.copy', { source: `config/${path}`, dest: `config/${dest}` })
  return dest
}

export const deleteConfigFile = (path: string): Promise<unknown> => (
  session.call('server.files.delete_file', { path: `config/${path}` })
)

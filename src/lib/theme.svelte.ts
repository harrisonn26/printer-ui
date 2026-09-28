import { browserTokenStore } from './moonraker/tokens'

export type ThemeChoice = 'system' | 'dark' | 'light'

const KEY = 'printer-ui:theme'

const load = (): ThemeChoice => {
  const saved = browserTokenStore.get(KEY)
  return saved === 'dark' || saved === 'light' ? saved : 'system'
}

class Theme {
  choice = $state<ThemeChoice>(load())

  constructor () {
    this.#apply()
  }

  set (choice: ThemeChoice): void {
    this.choice = choice
    if (choice === 'system') browserTokenStore.remove(KEY)
    else browserTokenStore.set(KEY, choice)
    this.#apply()
  }

  #apply (): void {
    if (this.choice === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = this.choice
  }
}

export const theme = new Theme()

// Hash routing: the app is served from a Pi or inside Orca's webview, where
// there's no server-side fallback to rely on.

export type Route = '/' | '/settings'

const ROUTES: readonly Route[] = ['/', '/settings']

const parse = (): Route => {
  const path = location.hash.replace(/^#/, '') || '/'
  return ROUTES.find(route => route === path) ?? '/'
}

class Router {
  current = $state<Route>(parse())

  constructor () {
    window.addEventListener('hashchange', () => { this.current = parse() })
  }

  href (route: Route): string {
    return `#${route}`
  }
}

export const router = new Router()

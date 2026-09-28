export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const TIMEOUT_MS: Record<ToastKind, number> = { info: 4000, success: 3000, warning: 6000, error: 8000 }

class Toasts {
  items = $state<Toast[]>([])
  #nextId = 1

  push (message: string, kind: ToastKind = 'info'): void {
    const id = this.#nextId++
    this.items.push({ id, kind, message })
    setTimeout(() => this.dismiss(id), TIMEOUT_MS[kind])
  }

  dismiss (id: number): void {
    this.items = this.items.filter(toast => toast.id !== id)
  }
}

export const toasts = new Toasts()

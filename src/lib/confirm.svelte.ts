export interface ConfirmRequest {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

class ConfirmStore {
  current = $state<(ConfirmRequest & { resolve: (value: boolean) => void }) | null>(null)

  /** Opens the modal; resolves true when the user confirms, false otherwise. */
  request (options: ConfirmRequest): Promise<boolean> {
    // A pending request is superseded: resolve it as cancelled.
    this.current?.resolve(false)
    return new Promise<boolean>((resolve) => {
      this.current = { ...options, resolve }
    })
  }

  resolve (value: boolean): void {
    this.current?.resolve(value)
    this.current = null
  }
}

export const confirmStore = new ConfirmStore()

/** Convenience wrapper so call sites read naturally. */
export const confirmAction = (options: ConfirmRequest): Promise<boolean> => confirmStore.request(options)

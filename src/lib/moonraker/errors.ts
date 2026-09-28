// Ported from Fluidd (src/util/is-socket-error.ts), GPL-3.0.

export interface SocketError {
  code: number
  message: string
}

export const JsonRpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603
} as const

export const isSocketError = (value: unknown): value is SocketError => (
  value != null &&
  typeof value === 'object' &&
  'code' in value &&
  typeof value.code === 'number' &&
  'message' in value &&
  typeof value.message === 'string'
)

// Moonraker's JSON-RPC layer rewrites a 401 to InvalidParams and a 404 to
// MethodNotFound; every other HTTP code passes through untouched.
export const isUnauthorizedError = (error: unknown): boolean => (
  isSocketError(error) && error.code === JsonRpcErrorCode.InvalidParams
)

// Also matches a method missing on an old Moonraker.
export const isNotFoundError = (error: unknown): boolean => (
  isSocketError(error) && error.code === JsonRpcErrorCode.MethodNotFound
)

export const errorMessage = (error: unknown): string => {
  if (isSocketError(error) || error instanceof Error) return error.message
  return String(error)
}

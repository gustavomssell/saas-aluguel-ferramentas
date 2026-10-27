import type { Session } from './types'

const STORAGE_KEY = 'canteiro.session'

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function saveSession(session: Session | null) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  else localStorage.removeItem(STORAGE_KEY)
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const session = loadSession()
  const authToken = token ?? session?.token

  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init.headers,
    },
  })

  if (response.status === 401) {
    onUnauthorized?.()
    throw new ApiError(401, 'Sessão expirada. Entre novamente.')
  }

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? 'Não foi possível concluir a operação',
      payload?.details,
    )
  }

  return payload as T
}

export async function downloadFile(path: string): Promise<Blob> {
  const session = loadSession()
  const response = await fetch(`/api${path}`, {
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {},
  })

  if (response.status === 401) {
    onUnauthorized?.()
    throw new ApiError(401, 'Sessão expirada. Entre novamente.')
  }

  if (!response.ok) {
    let message = 'Não foi possível baixar o arquivo'
    try {
      const payload = JSON.parse(await response.text())
      if (payload?.error) message = payload.error
    } catch {
      /* resposta sem corpo JSON */
    }
    throw new ApiError(response.status, message)
  }

  return response.blob()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

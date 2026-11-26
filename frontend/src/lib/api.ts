/**
 * Kalit CRM API klienti.
 *
 * Xavfsizlik:
 * - access token FAQAT xotirada (o'zgaruvchida) saqlanadi — localStorage'da emas;
 * - refresh token httpOnly cookie'da, JS uni umuman ko'rmaydi;
 * - har so'rovda `X-Kalit-Client: web` — backend cookie rejimini shu orqali yoqadi
 *   (boshqa saytdan yuborilgan forma bu sarlavhani qo'sha olmaydi -> CSRF himoyasi);
 * - 401 bo'lsa, bir marta refresh qilinadi (parallel so'rovlar bitta refresh'ni kutadi).
 */

const BASE = '/api/v1'
const CLIENT_HEADERS = { 'X-Kalit-Client': 'web' }

let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null
let onSessionExpired: (() => void) | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn
}

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown) {
    super(extractMessage(data) || `So'rov xatosi (${status})`)
    this.status = status
    this.data = data
  }

  /** Maydon bo'yicha xatolar: { phone: "...", password: "..." } */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {}
    if (this.data && typeof this.data === 'object' && !Array.isArray(this.data)) {
      for (const [key, value] of Object.entries(this.data as Record<string, unknown>)) {
        if (key === 'detail' || key === 'non_field_errors') continue
        const msg = flatten(value)
        if (msg) out[key] = msg
      }
    }
    return out
  }
}

function flatten(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(flatten).filter(Boolean).join(' ')
  return ''
}

function extractMessage(data: unknown): string {
  if (!data) return ''
  if (typeof data === 'string') return data.length < 200 ? data : ''
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (d.detail) return flatten(d.detail)
    if (d.non_field_errors) return flatten(d.non_field_errors)
    const first = Object.values(d)[0]
    return flatten(first)
  }
  return ''
}

async function parse(res: Response): Promise<unknown> {
  if (res.status === 204 || res.status === 205) return null
  const type = res.headers.get('content-type') || ''
  if (type.includes('application/json')) return res.json()
  const text = await res.text()
  return text || null
}

/** Refresh cookie orqali yangi access token olish. Parallel chaqiruvlar bitta so'rovni bo'lishadi. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh/`, {
      method: 'POST',
      headers: CLIENT_HEADERS,
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (!res.ok) {
          accessToken = null
          return false
        }
        const data = (await res.json()) as { access: string }
        accessToken = data.access
        return true
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Query
  signal?: AbortSignal
  /** login/refresh kabi so'rovlarda 401'dan keyin refresh qilinmaydi */
  noRetry?: boolean
}

function buildUrl(path: string, query?: Query) {
  const url = new URL(BASE + path, window.location.origin)
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
  }
  return url.pathname + url.search
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, noRetry } = opts
  const headers: Record<string, string> = { ...CLIENT_HEADERS, Accept: 'application/json' }
  let payload: BodyInit | undefined

  if (body instanceof FormData) {
    payload = body
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const doFetch = () =>
    fetch(buildUrl(path, query), {
      method,
      body: payload,
      signal,
      credentials: 'same-origin',
      headers: accessToken ? { ...headers, Authorization: `Bearer ${accessToken}` } : headers,
    })

  let res = await doFetch()

  if (res.status === 401 && !noRetry) {
    const ok = await refreshSession()
    if (ok) {
      res = await doFetch()
    } else {
      onSessionExpired?.()
    }
  }

  const data = await parse(res)
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

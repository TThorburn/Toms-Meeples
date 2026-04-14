/**
 * Base API client — all requests go through here.
 * Token is read from localStorage on every call so it's always fresh.
 */

const BASE_URL = '/api'

function getToken() {
  return localStorage.getItem('token')
}

async function request(method, path, body = undefined, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const config = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }

  const res = await fetch(`${BASE_URL}${path}`, config)

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`
    try {
      const err = await res.json()
      errorMessage = err.message || err.error || errorMessage
    } catch {
      // ignore parse error
    }
    throw new Error(errorMessage)
  }

  // 204 No Content
  if (res.status === 204) return null

  return res.json()
}

export const client = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, body, options) => request('POST', path, body, options),
  put: (path, body, options) => request('PUT', path, body, options),
  patch: (path, body, options) => request('PATCH', path, body, options),
  delete: (path, options) => request('DELETE', path, undefined, options),
}

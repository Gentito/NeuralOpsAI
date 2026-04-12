export type ApiResource = "agents" | "projects" | "tasks" | "clients" | "invoices"

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000"
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem("neuralops_access_token")
  } catch {
    return null
  }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBaseUrl()}${path}`
  const token = getAccessToken()
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {})
    }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }

  return (await res.json()) as T
}

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export function supabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  return { url, key }
}

export function supabaseServerClient() {
  const { url, key } = supabaseServerConfig()
  if (!url || !key) return null

  const cookieStore = cookies()

  return createServerClient(url, key, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value
      },
      set(name, value, options) {
        try {
          cookieStore.set({ name, value, ...options })
        } catch {}
      },
      remove(name, options) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 })
        } catch {}
      }
    }
  })
}


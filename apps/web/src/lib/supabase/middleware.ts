import { createServerClient } from "@supabase/ssr"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export function createSupabaseMiddlewareClient(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if (!url || !key) return null

  let res = NextResponse.next({ request: { headers: req.headers } })

  const supabase = createServerClient(url, key, {
    cookies: {
      get(name) {
        return req.cookies.get(name)?.value
      },
      set(name, value, options) {
        res.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        res.cookies.set({ name, value: "", ...options, maxAge: 0 })
      }
    }
  })

  return { supabase, res }
}


import { createClient } from "@supabase/supabase-js"

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  return { url, key }
}

export function supabaseClient() {
  const { url, key } = supabaseConfig()
  return url && key ? createClient(url, key) : null
}

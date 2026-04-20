import { NextResponse } from "next/server"

import { supabaseServerClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = supabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile?.role || profile.role === "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data, error } = await supabase
    .from("requests")
    .select("id, org_id, title, category, priority, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ requests: data || [] })
}


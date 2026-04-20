import { NextResponse } from "next/server"

import { supabaseServerClient } from "@/lib/supabase/server"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile?.role || profile.role === "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: job, error: jobError } = await supabase
    .from("automation_jobs")
    .select("id, org_id, entity_type, entity_id, job_type, status, priority, payload, result, error, attempts, locked_at, locked_by, created_at, updated_at")
    .eq("id", params.id)
    .maybeSingle()

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 400 })
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: events } = await supabase
    .from("automation_events")
    .select("id, level, message, metadata, created_at")
    .eq("job_id", params.id)
    .order("created_at", { ascending: true })
    .limit(200)

  return NextResponse.json({ job, events: events || [] })
}


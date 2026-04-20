import { NextResponse } from "next/server"

import { supabaseAdminClient } from "@/lib/supabase/admin"
import { authenticateSystemActor } from "@/lib/agent/auth"

export async function GET(request: Request) {
  const auth = await authenticateSystemActor(request).catch((e) => {
    return { error: e instanceof Error ? e.message : "Unauthorized" } as any
  })
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const supabase = supabaseAdminClient()
  if (!supabase) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })

  const { data: assignments, error } = await supabase
    .from("system_actor_assignments")
    .select("entity_id")
    .eq("actor_id", auth.actor.id)
    .eq("entity_type", "task")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const ids = (assignments || []).map((a: any) => a.entity_id as string)
  if (!ids.length) return NextResponse.json({ actor: auth.actor, tasks: [] })

  const { data: tasks, error: taskErr } = await supabase
    .from("tasks")
    .select("id, org_id, title, status, project_id, request_id, created_at, updated_at")
    .in("id", ids)
    .order("created_at", { ascending: true })

  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 400 })

  return NextResponse.json({ actor: auth.actor, tasks: tasks || [] })
}


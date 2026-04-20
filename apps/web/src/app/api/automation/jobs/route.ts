import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseServerClient } from "@/lib/supabase/server"

const schema = z.object({
  jobType: z.string().min(1).max(64),
  entityType: z.enum(["request", "project", "task"]).optional(),
  entityId: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(1000).optional(),
  payload: z.record(z.any()).optional()
})

export async function POST(request: Request) {
  const supabase = supabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role, primary_org_id").eq("id", user.id).maybeSingle()
  if (!profile?.role || profile.role === "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!profile.primary_org_id) return NextResponse.json({ error: "Missing organization" }, { status: 400 })

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })

  const input = parsed.data

  const { data: job, error } = await supabase
    .from("automation_jobs")
    .insert({
      org_id: profile.primary_org_id,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      job_type: input.jobType,
      priority: input.priority ?? 100,
      payload: input.payload ?? {}
    })
    .select("id, status, created_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ job })
}


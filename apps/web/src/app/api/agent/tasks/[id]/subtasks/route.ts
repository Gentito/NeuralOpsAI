import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseAdminClient } from "@/lib/supabase/admin"
import { authenticateSystemActor } from "@/lib/agent/auth"
import { logAgentAction } from "@/lib/agent/log"

const schema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(20000).optional()
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authenticateSystemActor(request).catch((e) => {
    return { error: e instanceof Error ? e.message : "Unauthorized" } as any
  })
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })

  const supabase = supabaseAdminClient()
  if (!supabase) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })

  const taskId = params.id

  const { data: assignment } = await supabase
    .from("system_actor_assignments")
    .select("id")
    .eq("actor_id", auth.actor.id)
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .eq("status", "active")
    .maybeSingle()

  if (!assignment?.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: parent, error: parentErr } = await supabase
    .from("tasks")
    .select("id, org_id, project_id, request_id")
    .eq("id", taskId)
    .single()
  if (parentErr) return NextResponse.json({ error: parentErr.message }, { status: 400 })
  if (parent.org_id !== auth.actor.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: subtask, error: createErr } = await supabase
    .from("tasks")
    .insert({
      org_id: parent.org_id,
      project_id: parent.project_id,
      request_id: parent.request_id,
      title: parsed.data.title,
      status: "todo",
      source: "agent_subtask"
    })
    .select("id, created_at")
    .single()

  if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

  await logAgentAction({
    orgId: parent.org_id,
    actorId: auth.actor.id,
    entityType: "task",
    entityId: taskId,
    action: "task.subtask_created",
    metadata: { subtask_id: subtask.id, title: parsed.data.title }
  })

  return NextResponse.json({ ok: true, subtask })
}


import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseAdminClient } from "@/lib/supabase/admin"
import { authenticateSystemActor } from "@/lib/agent/auth"
import { logAgentAction } from "@/lib/agent/log"

const schema = z.object({
  summary: z.string().trim().min(1).max(20000).optional(),
  createClientUpdateDraft: z.boolean().optional()
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authenticateSystemActor(request).catch((e) => {
    return { error: e instanceof Error ? e.message : "Unauthorized" } as any
  })
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const json = await request.json().catch(() => ({}))
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

  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id, org_id, status, project_id, request_id, title")
    .eq("id", taskId)
    .single()
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 400 })
  if (task.org_id !== auth.actor.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const fromStatus = task.status as string
  await supabase.from("tasks").update({ status: "done" }).eq("id", taskId)

  await supabase.from("task_status_history").insert({
    org_id: task.org_id,
    task_id: taskId,
    from_status: fromStatus,
    to_status: "done",
    changed_by_actor_id: auth.actor.id,
    reason: "Completed by system actor"
  })

  if (parsed.data.summary) {
    await supabase.from("comments").insert({
      org_id: task.org_id,
      entity_type: "task",
      entity_id: taskId,
      visibility: "internal",
      body: `Completion summary:\n${parsed.data.summary}`,
      created_by: null,
      created_by_actor_id: auth.actor.id
    })
  }

  await supabase
    .from("system_actor_assignments")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("id", assignment.id)

  await logAgentAction({
    orgId: task.org_id,
    actorId: auth.actor.id,
    entityType: "task",
    entityId: taskId,
    action: "task.completed",
    metadata: { from: fromStatus, to: "done" }
  })

  if (parsed.data.createClientUpdateDraft && task.request_id) {
    await supabase.from("automation_jobs").insert({
      org_id: task.org_id,
      entity_type: "request",
      entity_id: task.request_id,
      job_type: "client_update_draft",
      priority: 80,
      payload: { requestId: task.request_id, projectId: task.project_id ?? null, completedTaskId: taskId }
    })
  }

  return NextResponse.json({ ok: true })
}


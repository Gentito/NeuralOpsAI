import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseAdminClient } from "@/lib/supabase/admin"
import { authenticateSystemActor } from "@/lib/agent/auth"
import { logAgentAction } from "@/lib/agent/log"

const schema = z.object({
  toHistoryId: z.string().uuid().optional()
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await authenticateSystemActor(request).catch((e) => {
    return { error: e instanceof Error ? e.message : "Unauthorized" } as any
  })
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json || {})
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

  const { data: task, error: taskErr } = await supabase.from("tasks").select("id, org_id, status").eq("id", taskId).single()
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 400 })
  if (task.org_id !== auth.actor.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: history } = parsed.data.toHistoryId
    ? await supabase.from("task_status_history").select("id, from_status, to_status, created_at").eq("id", parsed.data.toHistoryId).single()
    : await supabase
        .from("task_status_history")
        .select("id, from_status, to_status, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

  if (!history?.id) return NextResponse.json({ error: "No status history found" }, { status: 404 })

  const revertTo = history.from_status || "todo"
  const fromStatus = task.status as string

  await supabase.from("tasks").update({ status: revertTo }).eq("id", taskId)

  await supabase.from("task_status_history").insert({
    org_id: task.org_id,
    task_id: taskId,
    from_status: fromStatus,
    to_status: revertTo,
    changed_by_actor_id: auth.actor.id,
    reason: `Reverted via history ${history.id}`
  })

  await logAgentAction({
    orgId: task.org_id,
    actorId: auth.actor.id,
    entityType: "task",
    entityId: taskId,
    action: "task.status_reverted",
    reversible: true,
    metadata: { from: fromStatus, to: revertTo, history_id: history.id }
  })

  return NextResponse.json({ ok: true, from: fromStatus, to: revertTo })
}


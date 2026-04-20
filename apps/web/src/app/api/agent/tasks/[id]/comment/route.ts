import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseAdminClient } from "@/lib/supabase/admin"
import { authenticateSystemActor } from "@/lib/agent/auth"
import { logAgentAction } from "@/lib/agent/log"

const schema = z.object({
  body: z.string().trim().min(1).max(20000)
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

  const { data: task, error: taskErr } = await supabase.from("tasks").select("id, org_id").eq("id", taskId).single()
  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 400 })
  if (task.org_id !== auth.actor.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: comment, error: commentErr } = await supabase
    .from("comments")
    .insert({
      org_id: task.org_id,
      entity_type: "task",
      entity_id: task.id,
      visibility: "internal",
      body: parsed.data.body,
      created_by: null,
      created_by_actor_id: auth.actor.id
    })
    .select("id, created_at")
    .single()

  if (commentErr) return NextResponse.json({ error: commentErr.message }, { status: 400 })

  await logAgentAction({
    orgId: task.org_id,
    actorId: auth.actor.id,
    entityType: "task",
    entityId: task.id,
    action: "task.comment",
    metadata: { comment_id: comment.id }
  })

  return NextResponse.json({ ok: true, comment })
}


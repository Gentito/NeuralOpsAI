import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseServerClient } from "@/lib/supabase/server"
import { supabaseAdminClient } from "@/lib/supabase/admin"

const schema = z.object({
  entityType: z.enum(["request", "project", "task"]),
  entityId: z.string().uuid()
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile?.role || !["internal_admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })

  const admin = supabaseAdminClient()
  if (!admin) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })

  const actorId = params.id

  const { data: actor, error: actorErr } = await admin.from("system_actors").select("id, org_id, status").eq("id", actorId).maybeSingle()
  if (actorErr) return NextResponse.json({ error: actorErr.message }, { status: 400 })
  if (!actor?.id) return NextResponse.json({ error: "Actor not found" }, { status: 404 })
  if (actor.status !== "active") return NextResponse.json({ error: "Actor disabled" }, { status: 400 })

  const { error: insertErr } = await admin.from("system_actor_assignments").insert({
    org_id: actor.org_id,
    entity_type: parsed.data.entityType,
    entity_id: parsed.data.entityId,
    actor_id: actorId,
    status: "active",
    assigned_by: user.id
  })

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}


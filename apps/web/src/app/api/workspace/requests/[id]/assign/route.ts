import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseServerClient } from "@/lib/supabase/server"

const schema = z.object({
  agentUserId: z.string().uuid()
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile?.role || profile.role === "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })

  const requestId = params.id

  const { data: reqRow, error: reqError } = await supabase.from("requests").select("id, org_id").eq("id", requestId).maybeSingle()
  if (reqError) return NextResponse.json({ error: reqError.message }, { status: 400 })
  if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 })

  const { data: agentProfile, error: agentError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", parsed.data.agentUserId)
    .maybeSingle()

  if (agentError) return NextResponse.json({ error: agentError.message }, { status: 400 })
  if (!agentProfile || agentProfile.role !== "agent") return NextResponse.json({ error: "Invalid agent" }, { status: 400 })

  const { error: insertError } = await supabase.from("agent_assignments").insert({
    org_id: reqRow.org_id,
    entity_type: "request",
    entity_id: reqRow.id,
    agent_user_id: parsed.data.agentUserId,
    assigned_by: user.id
  })

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

  await supabase.from("requests").update({ status: "assigned" }).eq("id", reqRow.id)

  return NextResponse.json({ ok: true })
}


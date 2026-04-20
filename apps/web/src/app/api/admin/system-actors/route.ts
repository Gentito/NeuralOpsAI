import { NextResponse } from "next/server"
import { createHash, randomBytes } from "crypto"
import { z } from "zod"

import { supabaseServerClient } from "@/lib/supabase/server"
import { supabaseAdminClient } from "@/lib/supabase/admin"

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["automation", "trae_agent", "integration_worker"]).default("trae_agent"),
  orgId: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(64).optional(),
  expiresAt: z.string().trim().min(1).optional(),
  permissions: z.record(z.any()).optional()
})

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

export async function GET() {
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

  const admin = supabaseAdminClient()
  if (!admin) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })

  const { data: actors, error } = await admin
    .from("system_actors")
    .select("id, org_id, kind, name, status, permissions, created_at")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ actors: actors || [] })
}

export async function POST(request: Request) {
  const supabase = supabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role, primary_org_id").eq("id", user.id).maybeSingle()
  if (!profile?.role || !["internal_admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })

  const admin = supabaseAdminClient()
  if (!admin) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })

  const orgId = parsed.data.orgId || profile.primary_org_id
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 })

  const token = `nops_${randomBytes(32).toString("hex")}`
  const tokenHash = sha256Hex(token)

  const { data: actor, error: actorErr } = await admin
    .from("system_actors")
    .insert({
      org_id: orgId,
      kind: parsed.data.kind,
      name: parsed.data.name,
      status: "active",
      permissions: parsed.data.permissions ?? {}
    })
    .select("id, org_id, kind, name, status, created_at")
    .single()

  if (actorErr) return NextResponse.json({ error: actorErr.message }, { status: 400 })

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt).toISOString() : null

  const { data: tokenRow, error: tokenErr } = await admin
    .from("system_actor_tokens")
    .insert({
      actor_id: actor.id,
      token_hash: tokenHash,
      label: parsed.data.label ?? "default",
      status: "active",
      expires_at: expiresAt
    })
    .select("id, created_at")
    .single()

  if (tokenErr) return NextResponse.json({ error: tokenErr.message }, { status: 400 })

  return NextResponse.json({
    actor,
    token: {
      id: tokenRow.id,
      value: token
    }
  })
}

import { NextResponse } from "next/server"

import { supabaseServerClient } from "@/lib/supabase/server"
import { requestCreateSchema } from "@/lib/validation"

export async function POST(request: Request) {
  const supabase = supabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const json = await request.json().catch(() => null)
  const parsed = requestCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const input = parsed.data

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("primary_org_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile?.primary_org_id) return NextResponse.json({ error: "Missing organization" }, { status: 400 })
  if (profile.role !== "client") return NextResponse.json({ error: "Only clients can submit requests" }, { status: 403 })

  const preferred_deadline = input.preferredDeadline ? new Date(input.preferredDeadline).toISOString().slice(0, 10) : null

  const { data: created, error: createError } = await supabase
    .from("requests")
    .insert({
      org_id: profile.primary_org_id,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      preferred_deadline,
      budget: input.budget ?? null,
      contact_email: input.contactEmail ?? null,
      contact_phone: input.contactPhone ?? null,
      source: "portal"
    })
    .select("id, org_id, status, created_at")
    .single()

  if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })

  return NextResponse.json({ request: created })
}


import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseServerClient } from "@/lib/supabase/server"

const schema = z.object({
  status: z.enum(["new", "triaged", "in_review", "assigned", "in_progress", "waiting_for_client", "completed", "cancelled"])
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

  const { error } = await supabase.from("requests").update({ status: parsed.data.status }).eq("id", params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}


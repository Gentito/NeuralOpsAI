import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseServerClient } from "@/lib/supabase/server"

const schema = z.object({
  storagePath: z.string().min(1).max(1024),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  size: z.number().int().positive().max(25 * 1024 * 1024)
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const json = await request.json().catch(() => null)
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })

  const requestId = params.id

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("primary_org_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile?.primary_org_id) return NextResponse.json({ error: "Missing organization" }, { status: 400 })
  if (profile.role !== "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: reqRow, error: reqError } = await supabase
    .from("requests")
    .select("id, org_id")
    .eq("id", requestId)
    .maybeSingle()

  if (reqError) return NextResponse.json({ error: reqError.message }, { status: 400 })
  if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 })
  if (reqRow.org_id !== profile.primary_org_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const input = parsed.data
  const expectedPrefix = `${reqRow.org_id}/requests/${reqRow.id}/`
  if (!input.storagePath.startsWith(expectedPrefix)) return NextResponse.json({ error: "Invalid storage path" }, { status: 400 })

  const { data: fileRow, error: insertError } = await supabase
    .from("files")
    .insert({
      org_id: reqRow.org_id,
      original_name: input.originalName,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      size: input.size,
      source: "portal_upload",
      linked_entity_type: "request",
      linked_entity_id: reqRow.id,
      uploaded_by: user.id
    })
    .select("id, storage_path, original_name, mime_type, size, created_at")
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

  return NextResponse.json({ file: fileRow })
}


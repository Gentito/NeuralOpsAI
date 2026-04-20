import { NextResponse } from "next/server"

import { supabaseServerClient } from "@/lib/supabase/server"
import { uploadPrepareSchema } from "@/lib/validation"

function sanitizeFilename(name: string) {
  const cleaned = name.replace(/[^\w.\-+() ]+/g, "_").replace(/\s+/g, " ").trim()
  return cleaned.length ? cleaned : "attachment"
}

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "text/plain",
  "image/png",
  "image/jpeg"
])

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const json = await request.json().catch(() => null)
  const parsed = uploadPrepareSchema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload", details: parsed.error.flatten() }, { status: 400 })

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("primary_org_id, role")
    .eq("id", user.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile?.primary_org_id) return NextResponse.json({ error: "Missing organization" }, { status: 400 })
  if (profile.role !== "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const requestId = params.id
  const { data: reqRow, error: reqError } = await supabase
    .from("requests")
    .select("id, org_id")
    .eq("id", requestId)
    .maybeSingle()

  if (reqError) return NextResponse.json({ error: reqError.message }, { status: 400 })
  if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 })
  if (reqRow.org_id !== profile.primary_org_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const input = parsed.data
  if (!ALLOWED_MIME.has(input.mimeType)) return NextResponse.json({ error: "File type not allowed" }, { status: 400 })

  const safeName = sanitizeFilename(input.originalName)
  const uploadId = crypto.randomUUID()
  const storagePath = `${reqRow.org_id}/requests/${reqRow.id}/${uploadId}-${safeName}`

  return NextResponse.json({
    bucket: "attachments",
    storagePath,
    originalName: safeName
  })
}


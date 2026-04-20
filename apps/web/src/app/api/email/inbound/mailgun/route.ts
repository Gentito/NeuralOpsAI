import { NextResponse } from "next/server"

import { verifyMailgunSignature, firstNonEmpty } from "@/lib/email/mailgun"
import { supabaseAdminClient } from "@/lib/supabase/admin"

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").trim()
}

function guessThreadId(headers: Record<string, string>) {
  const inReplyTo = headers["in-reply-to"] || ""
  const references = headers["references"] || ""
  return firstNonEmpty(inReplyTo, references)
}

function asString(v: unknown) {
  return typeof v === "string" ? v : ""
}

function parseHeaders(raw: string) {
  const out: Record<string, string> = {}
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (!key) continue
    if (out[key]) out[key] = `${out[key]}\n${value}`
    else out[key] = value
  }
  return out
}

export async function POST(request: Request) {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY || ""
  if (!signingKey) return NextResponse.json({ error: "Missing MAILGUN_WEBHOOK_SIGNING_KEY" }, { status: 500 })

  const supabase = supabaseAdminClient()
  if (!supabase) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })

  const form = await request.formData()

  const timestamp = asString(form.get("timestamp"))
  const token = asString(form.get("token"))
  const signature = asString(form.get("signature"))

  if (!verifyMailgunSignature({ timestamp, token, signature }, signingKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const rawHeaders = asString(form.get("message-headers"))
  const headers = parseHeaders(rawHeaders)

  const providerMessageId = firstNonEmpty(
    asString(form.get("Message-Id")),
    headers["message-id"],
    asString(form.get("message-id"))
  )

  if (!providerMessageId) return NextResponse.json({ error: "Missing message id" }, { status: 400 })

  const { data: existing } = await supabase
    .from("email_messages")
    .select("id")
    .eq("provider", "mailgun")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle()

  if (existing?.id) return NextResponse.json({ ok: true, deduped: true })

  const fromEmail = firstNonEmpty(asString(form.get("sender")), asString(form.get("from")), headers["from"])
  const subject = firstNonEmpty(asString(form.get("subject")), headers["subject"])
  const textBody = firstNonEmpty(asString(form.get("stripped-text")), asString(form.get("body-plain")))
  const htmlBody = firstNonEmpty(asString(form.get("stripped-html")), asString(form.get("body-html")))
  const receivedAt = new Date(Number(timestamp) * 1000).toISOString()
  const threadId = guessThreadId(headers)

  const { data: internalOrgId, error: orgErr } = await supabase.rpc("ensure_internal_org")
  if (orgErr || !internalOrgId) return NextResponse.json({ error: "Failed to resolve internal org" }, { status: 500 })
  const orgId = internalOrgId as string

  const { data: emailRow, error: emailErr } = await supabase
    .from("email_messages")
    .insert({
      org_id: orgId,
      provider: "mailgun",
      provider_message_id: providerMessageId,
      thread_id: threadId || null,
      from_email: fromEmail,
      from_name: null,
      subject: subject || null,
      text_body: textBody || null,
      html_body: htmlBody || null,
      received_at: receivedAt
    })
    .select("id")
    .single()

  if (emailErr) {
    const msg = emailErr.message || ""
    if (msg.toLowerCase().includes("duplicate")) return NextResponse.json({ ok: true, deduped: true })
    return NextResponse.json({ error: emailErr.message }, { status: 400 })
  }

  const title = subject || `Email request from ${fromEmail}`
  const description = normalizeText(firstNonEmpty(textBody, htmlBody, "(No content)"))
  const category = "Email Intake"

  const { data: createdRequest, error: reqErr } = await supabase
    .from("requests")
    .insert({
      org_id: orgId,
      title,
      description,
      category,
      priority: "medium",
      source: "email",
      contact_email: fromEmail
    })
    .select("id, org_id")
    .single()

  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 400 })

  const requestId = createdRequest.id as string
  const requestOrgId = createdRequest.org_id as string

  await supabase.from("email_messages").update({ request_id: requestId }).eq("id", emailRow.id)

  const uploadResults: Array<{ storagePath: string; name: string }> = []

  for (const [key, value] of form.entries()) {
    if (!key.startsWith("attachment")) continue
    if (!(value instanceof File)) continue
    if (value.size <= 0) continue

    const safeName = value.name.replace(/[^\w.\-+() ]+/g, "_").replace(/\s+/g, " ").trim() || "attachment"
    const uploadId = crypto.randomUUID()
    const storagePath = `${requestOrgId}/requests/${requestId}/${uploadId}-${safeName}`

    const bytes = Buffer.from(await value.arrayBuffer())

    const { error: uploadErr } = await supabase.storage.from("attachments").upload(storagePath, bytes, {
      contentType: value.type || "application/octet-stream",
      upsert: false
    })

    if (uploadErr) continue

    const { error: fileErr } = await supabase.from("files").insert({
      org_id: requestOrgId,
      original_name: safeName,
      storage_path: storagePath,
      mime_type: value.type || "application/octet-stream",
      size: value.size,
      source: "email_attachment",
      linked_entity_type: "request",
      linked_entity_id: requestId,
      uploaded_by: null
    })

    if (!fileErr) uploadResults.push({ storagePath, name: safeName })
  }

  return NextResponse.json({ ok: true, emailId: emailRow.id, requestId, attachments: uploadResults.length })
}

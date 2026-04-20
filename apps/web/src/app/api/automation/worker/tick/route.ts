import { NextResponse } from "next/server"

import { processAutomationJob } from "@/lib/automation/worker"
import { supabaseAdminClient } from "@/lib/supabase/admin"

export async function POST(request: Request) {
  const secret = process.env.AUTOMATION_WORKER_SECRET || ""
  if (!secret) return NextResponse.json({ error: "Missing AUTOMATION_WORKER_SECRET" }, { status: 500 })

  const header = request.headers.get("x-automation-secret") || ""
  if (header !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = supabaseAdminClient()
  if (!supabase) return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })

  const workerId = request.headers.get("x-worker-id") || "vercel-cron"

  const { data: job, error } = await supabase.rpc("claim_next_automation_job", { worker_id: workerId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!job?.id) return NextResponse.json({ ok: true, idle: true })

  await processAutomationJob(job)

  const { data: updated } = await supabase.from("automation_jobs").select("id, status, updated_at, error").eq("id", job.id).single()
  return NextResponse.json({ ok: true, job: updated })
}


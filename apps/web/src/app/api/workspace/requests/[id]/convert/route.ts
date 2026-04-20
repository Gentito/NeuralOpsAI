import { NextResponse } from "next/server"
import { z } from "zod"

import { supabaseServerClient } from "@/lib/supabase/server"

const schema = z.object({
  template: z.enum(["website", "bugfix", "operations", "generic"]).default("generic")
})

function tasksForTemplate(template: string) {
  switch (template) {
    case "website":
      return [
        "Discovery + requirements",
        "Design / UX",
        "Frontend implementation",
        "Backend implementation",
        "QA + performance",
        "Deploy + handoff"
      ]
    case "bugfix":
      return ["Triage + reproduce", "Fix", "QA + verify", "Deploy"]
    case "operations":
      return ["Clarify scope", "Execute", "QA + confirmation"]
    default:
      return ["Triage", "Execution", "QA", "Delivery"]
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = supabaseServerClient()
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 })

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (!profile?.role || profile.role === "client") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const json = await request.json().catch(() => ({}))
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 })

  const requestId = params.id
  const { data: reqRow, error: reqError } = await supabase
    .from("requests")
    .select("id, org_id, title, status")
    .eq("id", requestId)
    .maybeSingle()

  if (reqError) return NextResponse.json({ error: reqError.message }, { status: 400 })
  if (!reqRow) return NextResponse.json({ error: "Request not found" }, { status: 404 })

  const { data: existingProject } = await supabase.from("projects").select("id").eq("request_id", reqRow.id).maybeSingle()
  if (existingProject?.id) return NextResponse.json({ error: "Already converted", projectId: existingProject.id }, { status: 409 })

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      org_id: reqRow.org_id,
      request_id: reqRow.id,
      name: reqRow.title,
      status: "active"
    })
    .select("id")
    .single()

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 400 })

  const taskTitles = tasksForTemplate(parsed.data.template)
  const taskRows = taskTitles.map((t) => ({
    org_id: reqRow.org_id,
    request_id: reqRow.id,
    title: t,
    status: "todo",
    project_id: project.id,
    source: "request_template"
  }))

  const { error: tasksError } = await supabase.from("tasks").insert(taskRows)
  if (tasksError) return NextResponse.json({ error: tasksError.message }, { status: 400 })

  await supabase.from("requests").update({ status: "in_progress" }).eq("id", reqRow.id)

  return NextResponse.json({ ok: true, projectId: project.id })
}


import { llmJson } from "@/lib/automation/llm"
import { supabaseAdminClient } from "@/lib/supabase/admin"

import type { AutomationJob, LinkedEntityType } from "@/lib/automation/types"

async function addEvent(jobId: string, level: string, message: string, metadata?: any) {
  const supabase = supabaseAdminClient()
  if (!supabase) return
  await supabase.from("automation_events").insert({
    job_id: jobId,
    level,
    message,
    metadata: metadata ?? {}
  })
}

async function succeed(jobId: string, result: any) {
  const supabase = supabaseAdminClient()
  if (!supabase) return
  await supabase
    .from("automation_jobs")
    .update({ status: "succeeded", result: result ?? {}, error: null, locked_at: null, locked_by: null })
    .eq("id", jobId)
}

async function fail(jobId: string, err: unknown) {
  const supabase = supabaseAdminClient()
  if (!supabase) return
  const message = err instanceof Error ? err.message : "Unknown error"
  await supabase
    .from("automation_jobs")
    .update({ status: "failed", error: message, locked_at: null, locked_by: null })
    .eq("id", jobId)
  await addEvent(jobId, "error", message)
}

async function runRequestTriage(job: AutomationJob) {
  const supabase = supabaseAdminClient()
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  if (job.entity_type !== "request" || !job.entity_id) throw new Error("Invalid job entity")

  const { data: reqRow, error: reqErr } = await supabase
    .from("requests")
    .select("id, org_id, title, description, category, priority, status, preferred_deadline, budget, contact_email, created_at")
    .eq("id", job.entity_id)
    .single()
  if (reqErr) throw new Error(reqErr.message)

  await addEvent(job.id, "info", "Loaded request", { requestId: reqRow.id })

  type TriageResult = {
    summary: string
    recommended_status: "triaged" | "in_review" | "assigned" | "in_progress" | "waiting_for_client"
    recommended_template: "website" | "bugfix" | "operations" | "generic"
    key_questions: string[]
    suggested_tasks: string[]
    confidence: number
  }

  const triage = await llmJson<TriageResult>({
    schemaHint:
      "{summary:string,recommended_status:string,recommended_template:string,key_questions:string[],suggested_tasks:string[],confidence:number}",
    messages: [
      {
        role: "user",
        content:
          "Triage this client request for an internal delivery team. Provide a crisp summary, recommended workflow template, key questions, and suggested task list.\n\n" +
          JSON.stringify(reqRow, null, 2)
      }
    ]
  })

  await addEvent(job.id, "info", "Generated triage", { confidence: triage.confidence })

  const nextStatus = reqRow.status === "new" ? triage.recommended_status : reqRow.status
  await supabase.from("requests").update({ status: nextStatus }).eq("id", reqRow.id)

  const commentBody =
    `AI Triage Summary:\n${triage.summary}\n\n` +
    `Recommended template: ${triage.recommended_template}\n` +
    `Recommended status: ${triage.recommended_status}\n` +
    `Confidence: ${triage.confidence}\n\n` +
    `Key questions:\n- ${triage.key_questions.join("\n- ") || "None"}\n\n` +
    `Suggested tasks:\n- ${triage.suggested_tasks.join("\n- ") || "None"}\n`

  await supabase.from("comments").insert({
    org_id: reqRow.org_id,
    entity_type: "request",
    entity_id: reqRow.id,
    visibility: "internal",
    body: commentBody,
    created_by: null
  })

  return { triage, nextStatus }
}

async function runRequestPlan(job: AutomationJob) {
  const supabase = supabaseAdminClient()
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  if (job.entity_type !== "request" || !job.entity_id) throw new Error("Invalid job entity")

  const { data: reqRow, error: reqErr } = await supabase
    .from("requests")
    .select("id, org_id, title, description, category, priority, status, preferred_deadline, budget, contact_email, created_at")
    .eq("id", job.entity_id)
    .single()
  if (reqErr) throw new Error(reqErr.message)

  const { data: existingProject } = await supabase.from("projects").select("id").eq("request_id", reqRow.id).maybeSingle()
  if (existingProject?.id) {
    await addEvent(job.id, "info", "Project already exists for request", { projectId: existingProject.id })
    return { projectId: existingProject.id, alreadyConverted: true }
  }

  type Plan = {
    project_name: string
    template: "website" | "bugfix" | "operations" | "generic"
    tasks: Array<{ title: string; description: string; priority: "low" | "medium" | "high" | "urgent" }>
    risks: string[]
    milestones: string[]
    confidence: number
  }

  const plan = await llmJson<Plan>({
    schemaHint:
      "{project_name:string,template:string,tasks:{title:string,description:string,priority:string}[],risks:string[],milestones:string[],confidence:number}",
    messages: [
      {
        role: "user",
        content:
          "Create a production delivery plan for this client request. Provide a project name, a workflow template, and a task list with short descriptions. Keep it actionable.\n\n" +
          JSON.stringify(reqRow, null, 2)
      }
    ]
  })

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      org_id: reqRow.org_id,
      request_id: reqRow.id,
      name: plan.project_name || reqRow.title,
      status: "active"
    })
    .select("id")
    .single()

  if (projectError) throw new Error(projectError.message)

  const taskRows = (plan.tasks || []).slice(0, 40).map((t) => ({
    org_id: reqRow.org_id,
    request_id: reqRow.id,
    title: t.title,
    status: "todo",
    project_id: project.id,
    source: "automation_plan"
  }))

  if (taskRows.length) {
    const { error: tasksError } = await supabase.from("tasks").insert(taskRows)
    if (tasksError) throw new Error(tasksError.message)
  }

  await supabase.from("requests").update({ status: reqRow.status === "new" ? "triaged" : reqRow.status }).eq("id", reqRow.id)

  const summary =
    `AI Plan:\nProject: ${plan.project_name || reqRow.title}\nTemplate: ${plan.template}\nConfidence: ${plan.confidence}\n\n` +
    `Milestones:\n- ${(plan.milestones || []).join("\n- ") || "None"}\n\n` +
    `Risks:\n- ${(plan.risks || []).join("\n- ") || "None"}\n\n` +
    `Tasks:\n- ${(plan.tasks || []).map((x) => x.title).join("\n- ") || "None"}\n`

  await supabase.from("comments").insert({
    org_id: reqRow.org_id,
    entity_type: "request",
    entity_id: reqRow.id,
    visibility: "internal",
    body: summary,
    created_by: null
  })

  await supabase.from("automation_jobs").insert({
    org_id: reqRow.org_id,
    entity_type: "project",
    entity_id: project.id,
    job_type: "assign_agents",
    priority: 60,
    payload: { requestId: reqRow.id, projectId: project.id, template: plan.template }
  })

  await supabase.from("automation_jobs").insert({
    org_id: reqRow.org_id,
    entity_type: "request",
    entity_id: reqRow.id,
    job_type: "client_update_draft",
    priority: 80,
    payload: { requestId: reqRow.id, projectId: project.id }
  })

  return { plan, projectId: project.id, taskCount: taskRows.length }
}

async function pickAgents(supabase: ReturnType<typeof supabaseAdminClient>, orgId: string) {
  if (!supabase) return []
  const { data: agents } = await supabase.from("profiles").select("id, full_name, email").eq("role", "agent").order("created_at", { ascending: true }).limit(20)
  return (agents || []).map((a: any) => ({ id: a.id as string, name: (a.full_name as string) || (a.email as string) || a.id }))
}

async function runAssignAgents(job: AutomationJob) {
  const supabase = supabaseAdminClient()
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  const projectId = (job.payload?.projectId as string | undefined) || job.entity_id || null
  if (!projectId) throw new Error("Missing projectId")

  const { data: project, error: projErr } = await supabase.from("projects").select("id, org_id, request_id, name").eq("id", projectId).single()
  if (projErr) throw new Error(projErr.message)

  const { data: tasks, error: taskErr } = await supabase
    .from("tasks")
    .select("id, title, status")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true })

  if (taskErr) throw new Error(taskErr.message)

  const agents = await pickAgents(supabase, project.org_id)
  if (!agents.length) throw new Error("No agents available (profiles.role='agent')")

  let idx = 0
  const assigned: Array<{ taskId: string; agentId: string }> = []

  for (const t of tasks || []) {
    const agent = agents[idx % agents.length]
    idx += 1

    await supabase.from("tasks").update({ assigned_user_id: agent.id }).eq("id", t.id)
    await supabase.from("agent_assignments").insert({
      org_id: project.org_id,
      entity_type: "task",
      entity_id: t.id,
      agent_user_id: agent.id,
      assigned_by: null
    })
    assigned.push({ taskId: t.id, agentId: agent.id })

    await supabase.from("automation_jobs").insert({
      org_id: project.org_id,
      entity_type: "task",
      entity_id: t.id,
      job_type: "task_execute",
      priority: 120,
      payload: { projectId: project.id, requestId: project.request_id }
    })
  }

  await supabase.from("agent_assignments").insert({
    org_id: project.org_id,
    entity_type: "project",
    entity_id: project.id,
    agent_user_id: agents[0].id,
    assigned_by: null
  })

  if (project.request_id) {
    await supabase.from("requests").update({ status: "assigned" }).eq("id", project.request_id)
  }

  await supabase.from("comments").insert({
    org_id: project.org_id,
    entity_type: "project",
    entity_id: project.id,
    visibility: "internal",
    body: `AI Assignment:\n- Assigned ${assigned.length} tasks across ${agents.length} agent(s).`,
    created_by: null
  })

  return { assignedCount: assigned.length, agentCount: agents.length }
}

async function runTaskExecute(job: AutomationJob) {
  const supabase = supabaseAdminClient()
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  if (job.entity_type !== "task" || !job.entity_id) throw new Error("Invalid job entity")

  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .select("id, org_id, title, status, project_id, request_id, assigned_user_id, source")
    .eq("id", job.entity_id)
    .single()
  if (taskErr) throw new Error(taskErr.message)

  const { data: requestRow } = task.request_id
    ? await supabase.from("requests").select("id, title, description, category, priority").eq("id", task.request_id).maybeSingle()
    : { data: null }

  type ExecPlan = {
    objective: string
    steps: string[]
    acceptance_criteria: string[]
    risks: string[]
    needs_human: boolean
    confidence: number
  }

  const plan = await llmJson<ExecPlan>({
    schemaHint: "{objective:string,steps:string[],acceptance_criteria:string[],risks:string[],needs_human:boolean,confidence:number}",
    messages: [
      {
        role: "user",
        content:
          "You are an internal delivery agent. Create an execution plan for this task. If real-world access or approvals are needed, set needs_human=true.\n\nTask:\n" +
          JSON.stringify(task, null, 2) +
          "\n\nRequest context:\n" +
          JSON.stringify(requestRow, null, 2)
      }
    ]
  })

  if (task.status === "todo") {
    await supabase.from("tasks").update({ status: "in_progress" }).eq("id", task.id)
  }

  const body =
    `AI Execution Plan:\nObjective: ${plan.objective}\nConfidence: ${plan.confidence}\nNeeds human: ${plan.needs_human}\n\n` +
    `Steps:\n- ${(plan.steps || []).join("\n- ") || "None"}\n\n` +
    `Acceptance criteria:\n- ${(plan.acceptance_criteria || []).join("\n- ") || "None"}\n\n` +
    `Risks:\n- ${(plan.risks || []).join("\n- ") || "None"}\n`

  await supabase.from("comments").insert({
    org_id: task.org_id,
    entity_type: "task",
    entity_id: task.id,
    visibility: "internal",
    body,
    created_by: null
  })

  return { plan }
}

async function runClientUpdateDraft(job: AutomationJob) {
  const supabase = supabaseAdminClient()
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  if (job.entity_type !== "request" || !job.entity_id) throw new Error("Invalid job entity")

  const { data: reqRow, error: reqErr } = await supabase
    .from("requests")
    .select("id, org_id, title, description, category, priority, status, created_at")
    .eq("id", job.entity_id)
    .single()
  if (reqErr) throw new Error(reqErr.message)

  const { data: project } = await supabase.from("projects").select("id, name, status").eq("request_id", reqRow.id).maybeSingle()

  type Draft = {
    subject: string
    message: string
    next_steps: string[]
    confidence: number
  }

  const draft = await llmJson<Draft>({
    schemaHint: "{subject:string,message:string,next_steps:string[],confidence:number}",
    messages: [
      {
        role: "user",
        content:
          "Draft a client-facing progress update (professional, concise). This is a DRAFT that will be approved by leadership before being sent.\n\n" +
          JSON.stringify({ request: reqRow, project }, null, 2)
      }
    ]
  })

  const { data: approval, error: approvalErr } = await supabase
    .from("approvals")
    .insert({
      org_id: reqRow.org_id,
      entity_type: "request",
      entity_id: reqRow.id,
      approval_type: "client_update",
      payload: {
        subject: draft.subject,
        message: draft.message,
        next_steps: draft.next_steps,
        confidence: draft.confidence,
        request_id: reqRow.id,
        project_id: project?.id ?? null
      },
      requested_by: null
    })
    .select("id")
    .single()

  if (approvalErr) throw new Error(approvalErr.message)

  await supabase.from("comments").insert({
    org_id: reqRow.org_id,
    entity_type: "request",
    entity_id: reqRow.id,
    visibility: "internal",
    body: `Client update draft generated and queued for approval.\nApproval ID: ${approval.id}\nSubject: ${draft.subject}\nConfidence: ${draft.confidence}`,
    created_by: null
  })

  return { approvalId: approval.id, draft }
}

async function runPublishClientUpdate(job: AutomationJob) {
  const supabase = supabaseAdminClient()
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  const approvalId = job.payload?.approvalId as string | undefined
  if (!approvalId) throw new Error("Missing approvalId")

  const { data: approval, error } = await supabase
    .from("approvals")
    .select("id, org_id, entity_type, entity_id, approval_type, status, payload")
    .eq("id", approvalId)
    .single()
  if (error) throw new Error(error.message)
  if (approval.status !== "approved") throw new Error(`Approval not approved (status=${approval.status})`)
  if (approval.approval_type !== "client_update") throw new Error("Unsupported approval type")
  if (approval.entity_type !== "request" || !approval.entity_id) throw new Error("Approval missing request entity")

  const subject = approval.payload?.subject ? String(approval.payload.subject) : "Update"
  const msg = approval.payload?.message ? String(approval.payload.message) : ""
  const next = Array.isArray(approval.payload?.next_steps) ? approval.payload.next_steps.map((x: any) => String(x)) : []

  const body = `${subject}\n\n${msg}\n\nNext steps:\n- ${next.join("\n- ") || "We’ll follow up shortly."}`

  await supabase.from("comments").insert({
    org_id: approval.org_id,
    entity_type: "request",
    entity_id: approval.entity_id,
    visibility: "client",
    body,
    created_by: null
  })

  return { published: true }
}

export async function processAutomationJob(job: AutomationJob) {
  await addEvent(job.id, "info", "Job started", { jobType: job.job_type })

  try {
    if (job.job_type === "request_triage") {
      const result = await runRequestTriage(job)
      await succeed(job.id, result)
      await addEvent(job.id, "info", "Job succeeded")
      return
    }

    if (job.job_type === "request_plan") {
      const result = await runRequestPlan(job)
      await succeed(job.id, result)
      await addEvent(job.id, "info", "Job succeeded")
      return
    }

    if (job.job_type === "assign_agents") {
      const result = await runAssignAgents(job)
      await succeed(job.id, result)
      await addEvent(job.id, "info", "Job succeeded")
      return
    }

    if (job.job_type === "task_execute") {
      const result = await runTaskExecute(job)
      await succeed(job.id, result)
      await addEvent(job.id, "info", "Job succeeded")
      return
    }

    if (job.job_type === "client_update_draft") {
      const result = await runClientUpdateDraft(job)
      await succeed(job.id, result)
      await addEvent(job.id, "info", "Job succeeded")
      return
    }

    if (job.job_type === "publish_client_update") {
      const result = await runPublishClientUpdate(job)
      await succeed(job.id, result)
      await addEvent(job.id, "info", "Job succeeded")
      return
    }

    throw new Error(`Unknown job_type: ${job.job_type}`)
  } catch (e) {
    await fail(job.id, e)
  }
}

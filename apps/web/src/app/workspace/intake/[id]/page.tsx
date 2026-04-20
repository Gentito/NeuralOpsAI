import Link from "next/link"
import { redirect } from "next/navigation"

import { Card } from "@/components/Card"
import { supabaseServerClient } from "@/lib/supabase/server"

const STATUSES = ["new", "triaged", "in_review", "assigned", "in_progress", "waiting_for_client", "completed", "cancelled"] as const
const TEMPLATES = ["website", "bugfix", "operations", "generic"] as const

export default async function IntakeDetailPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServerClient()
  if (!supabase) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Intake</h2>
        <div className="rounded-md border border-yellow-900 bg-yellow-950/40 p-4 text-sm text-yellow-200">
          Supabase is not configured.
        </div>
      </main>
    )
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role === "client") redirect("/portal")

  const requestId = params.id

  const { data: reqRow, error: reqError } = await supabase
    .from("requests")
    .select("id, org_id, title, description, category, priority, status, preferred_deadline, budget, contact_email, contact_phone, source, created_at")
    .eq("id", requestId)
    .maybeSingle()

  if (reqError) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Intake</h2>
        <div className="rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{reqError.message}</div>
      </main>
    )
  }

  if (!reqRow) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Intake</h2>
        <div className="rounded-md border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-200">Not found.</div>
      </main>
    )
  }

  const { data: files } = await supabase
    .from("files")
    .select("id, original_name, storage_path, mime_type, size, created_at")
    .eq("linked_entity_type", "request")
    .eq("linked_entity_id", requestId)
    .order("created_at", { ascending: false })

  const signed = await Promise.all(
    (files || []).map(async (f) => {
      const { data } = await supabase.storage.from("attachments").createSignedUrl(f.storage_path, 60)
      return { ...f, url: data?.signedUrl || null }
    })
  )

  const { data: activity } = await supabase
    .from("activity_logs")
    .select("id, action, visibility, metadata, created_at")
    .eq("entity_type", "request")
    .eq("entity_id", requestId)
    .order("created_at", { ascending: false })
    .limit(50)

  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, visibility, created_at, created_by")
    .eq("entity_type", "request")
    .eq("entity_id", requestId)
    .order("created_at", { ascending: true })

  const { data: automationJobs } = await supabase
    .from("automation_jobs")
    .select("id, job_type, status, created_at, updated_at, error")
    .eq("entity_type", "request")
    .eq("entity_id", requestId)
    .order("created_at", { ascending: false })
    .limit(10)

  const { data: agents } = await supabase.from("profiles").select("id, full_name, email").eq("role", "agent").order("created_at", { ascending: true })

  const updateStatus = async (formData: FormData) => {
    "use server"
    const supabase = supabaseServerClient()
    if (!supabase) return

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const status = String(formData.get("status") || "")
    if (!STATUSES.includes(status as any)) return

    await supabase.from("requests").update({ status }).eq("id", requestId)
    redirect(`/workspace/intake/${requestId}`)
  }

  const assignAgent = async (formData: FormData) => {
    "use server"
    const supabase = supabaseServerClient()
    if (!supabase) return

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    if (!profile?.role || !["internal_admin", "super_admin"].includes(profile.role)) return

    const agentUserId = String(formData.get("agentUserId") || "")
    if (!agentUserId) return

    const { data: reqRow } = await supabase.from("requests").select("id, org_id").eq("id", requestId).maybeSingle()
    if (!reqRow) return

    await supabase.from("agent_assignments").insert({
      org_id: reqRow.org_id,
      entity_type: "request",
      entity_id: reqRow.id,
      agent_user_id: agentUserId,
      assigned_by: user.id
    })

    await supabase.from("requests").update({ status: "assigned" }).eq("id", requestId)
    redirect(`/workspace/intake/${requestId}`)
  }

  const convertToProject = async (formData: FormData) => {
    "use server"
    const supabase = supabaseServerClient()
    if (!supabase) return

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    if (!profile?.role || !["internal_admin", "super_admin"].includes(profile.role)) return

    const template = String(formData.get("template") || "generic")
    if (!TEMPLATES.includes(template as any)) return

    const { data: reqRow } = await supabase.from("requests").select("id, org_id, title").eq("id", requestId).maybeSingle()
    if (!reqRow) return

    const { data: existingProject } = await supabase.from("projects").select("id").eq("request_id", reqRow.id).maybeSingle()
    if (existingProject?.id) {
      redirect(`/projects/${existingProject.id}`)
    }

    const { data: project } = await supabase
      .from("projects")
      .insert({ org_id: reqRow.org_id, request_id: reqRow.id, name: reqRow.title, status: "active" })
      .select("id")
      .single()

    if (!project?.id) return

    const taskTitles =
      template === "website"
        ? ["Discovery + requirements", "Design / UX", "Frontend implementation", "Backend implementation", "QA + performance", "Deploy + handoff"]
        : template === "bugfix"
          ? ["Triage + reproduce", "Fix", "QA + verify", "Deploy"]
          : template === "operations"
            ? ["Clarify scope", "Execute", "QA + confirmation"]
            : ["Triage", "Execution", "QA", "Delivery"]

    await supabase.from("tasks").insert(
      taskTitles.map((t) => ({
        org_id: reqRow.org_id,
        request_id: reqRow.id,
        title: t,
        status: "todo",
        project_id: project.id,
        source: "request_template"
      }))
    )

    await supabase.from("requests").update({ status: "in_progress" }).eq("id", requestId)
    redirect(`/projects/${project.id}`)
  }

  const createComment = async (formData: FormData) => {
    "use server"
    const supabase = supabaseServerClient()
    if (!supabase) return

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const body = String(formData.get("body") || "").trim()
    const visibility = String(formData.get("visibility") || "internal")
    if (!body) redirect(`/workspace/intake/${requestId}`)
    if (!["internal", "client"].includes(visibility)) redirect(`/workspace/intake/${requestId}`)

    await supabase.from("comments").insert({
      org_id: reqRow.org_id,
      entity_type: "request",
      entity_id: requestId,
      visibility,
      body,
      created_by: user.id
    })

    redirect(`/workspace/intake/${requestId}`)
  }

  const runTriage = async () => {
    "use server"
    const supabase = supabaseServerClient()
    if (!supabase) return

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data: profile } = await supabase.from("profiles").select("role, primary_org_id").eq("id", user.id).maybeSingle()
    if (!profile?.role || profile.role === "client") return
    if (!profile.primary_org_id) return

    await supabase.from("automation_jobs").insert({
      org_id: profile.primary_org_id,
      entity_type: "request",
      entity_id: requestId,
      job_type: "request_triage",
      priority: 50,
      payload: {}
    })

    redirect(`/workspace/intake/${requestId}`)
  }

  const runPlan = async () => {
    "use server"
    const supabase = supabaseServerClient()
    if (!supabase) return

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const { data: profile } = await supabase.from("profiles").select("role, primary_org_id").eq("id", user.id).maybeSingle()
    if (!profile?.role || profile.role === "client") return
    if (!profile.primary_org_id) return

    await supabase.from("automation_jobs").insert({
      org_id: profile.primary_org_id,
      entity_type: "request",
      entity_id: requestId,
      job_type: "request_plan",
      priority: 45,
      payload: {}
    })

    redirect(`/workspace/intake/${requestId}`)
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">Internal</div>
          <h2 className="text-2xl font-semibold">{reqRow.title}</h2>
          <div className="mt-1 text-sm text-slate-400">
            {reqRow.category} · {reqRow.priority} · {reqRow.status} · {new Date(reqRow.created_at).toLocaleString()}
          </div>
        </div>
        <Link href="/workspace/intake" className="text-sm text-slate-300 hover:text-white">
          Back to intake
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Routing">
          <div className="space-y-3">
            <form action={updateStatus} className="space-y-2">
              <div className="text-xs text-slate-400">Status</div>
              <select name="status" defaultValue={reqRow.status} className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button className="w-full rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white" type="submit">
                Update status
              </button>
            </form>

            <form action={assignAgent} className="space-y-2">
              <div className="text-xs text-slate-400">Assign agent</div>
              <select name="agentUserId" className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                {(agents || []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || a.email || a.id}
                  </option>
                ))}
              </select>
              <button className="w-full rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900" type="submit">
                Assign
              </button>
            </form>

            <form action={convertToProject} className="space-y-2">
              <div className="text-xs text-slate-400">Convert to project</div>
              <select name="template" defaultValue="generic" className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
                {TEMPLATES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500" type="submit">
                Convert
              </button>
            </form>
          </div>
        </Card>

        <div className="space-y-4 md:col-span-2">
          <Card title="Automation">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-200">Triage, plan, assign, and draft client updates.</div>
              <div className="flex flex-wrap gap-2">
                <form action={runTriage}>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md border border-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900"
                  >
                    Run triage
                  </button>
                </form>
                <form action={runPlan}>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    Generate plan
                  </button>
                </form>
              </div>
            </div>

            <div className="mt-5 divide-y divide-slate-800">
              {(automationJobs || []).length ? (
                (automationJobs || []).map((j) => (
                  <div key={j.id} className="py-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-slate-200">{j.job_type}</div>
                      <div className="text-slate-400">{j.status}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(j.created_at).toLocaleString()} · updated {new Date(j.updated_at).toLocaleString()}
                    </div>
                    {j.error ? <div className="mt-2 text-xs text-red-300">{j.error}</div> : null}
                    <Link href={`/api/automation/jobs/${j.id}`} className="mt-2 inline-flex text-xs text-slate-300 hover:text-white">
                      View job JSON
                    </Link>
                  </div>
                ))
              ) : (
                <div className="py-6 text-sm text-slate-400">No automation runs yet.</div>
              )}
            </div>
          </Card>

          <Card title="Request">
            <div className="space-y-3">
              <div className="whitespace-pre-wrap text-sm text-slate-200">{reqRow.description}</div>
              <div className="grid gap-2 text-sm text-slate-400 md:grid-cols-3">
                <div>Preferred deadline: {reqRow.preferred_deadline || "—"}</div>
                <div>Budget: {reqRow.budget == null ? "—" : `$${reqRow.budget}`}</div>
                <div>Source: {reqRow.source}</div>
              </div>
              <div className="grid gap-2 text-sm text-slate-400 md:grid-cols-2">
                <div>Contact email: {reqRow.contact_email || "—"}</div>
                <div>Contact phone: {reqRow.contact_phone || "—"}</div>
              </div>
            </div>
          </Card>

          <Card title="Attachments">
            {(signed || []).length ? (
              <div className="divide-y divide-slate-800">
                {signed.map((f) => (
                  <div key={f.id} className="flex flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-slate-200">{f.original_name}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {f.mime_type} · {Math.round((f.size / 1024) * 10) / 10} KB
                      </div>
                    </div>
                    {f.url ? (
                      <a
                        href={f.url}
                        className="inline-flex w-fit items-center justify-center rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                      >
                        Download
                      </a>
                    ) : (
                      <div className="text-xs text-slate-500">Link expired. Refresh to regenerate.</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">No attachments.</div>
            )}
          </Card>

          <Card title="Audit">
            {(activity || []).length ? (
              <div className="divide-y divide-slate-800">
                {(activity || []).map((a) => (
                  <div key={a.id} className="py-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div>{a.action}</div>
                      <div>{new Date(a.created_at).toLocaleString()}</div>
                    </div>
                    <pre className="mt-2 overflow-auto rounded-md border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-200">
                      {JSON.stringify(a.metadata, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400">No audit entries yet.</div>
            )}
          </Card>

          <Card title="Comments">
            <form action={createComment} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-slate-400">Visibility</div>
                <select
                  name="visibility"
                  defaultValue="internal"
                  className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                >
                  <option value="internal">Internal</option>
                  <option value="client">Client-visible</option>
                </select>
              </div>
              <textarea
                name="body"
                className="min-h-[110px] w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="Add a comment…"
              />
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-white"
                >
                  Post
                </button>
              </div>
            </form>

            <div className="mt-6 divide-y divide-slate-800">
              {(comments || []).length ? (
                (comments || []).map((c) => (
                  <div key={c.id} className="py-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div>{c.visibility}</div>
                      <div>{new Date(c.created_at).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{c.body}</div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-sm text-slate-400">No comments yet.</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </main>
  )
}

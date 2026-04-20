import Link from "next/link"
import { redirect } from "next/navigation"

import { Card } from "@/components/Card"
import { supabaseServerClient } from "@/lib/supabase/server"

export default async function AssignmentsPage() {
  const supabase = supabaseServerClient()
  if (!supabase) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Assignments</h2>
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

  const { data: assigned } = await supabase
    .from("agent_assignments")
    .select("entity_type, entity_id, created_at")
    .eq("agent_user_id", user.id)
    .order("created_at", { ascending: false })

  const requestIds = (assigned || []).filter((a) => a.entity_type === "request").map((a) => a.entity_id)
  const taskAssignmentIds = (assigned || []).filter((a) => a.entity_type === "task").map((a) => a.entity_id)

  const { data: requests } =
    requestIds.length > 0
      ? await supabase
          .from("requests")
          .select("id, title, category, priority, status, created_at")
          .in("id", requestIds)
          .order("created_at", { ascending: false })
      : { data: [] }

  const { data: tasksFromAssignments } =
    taskAssignmentIds.length > 0
      ? await supabase.from("tasks").select("id, title, status, project_id, created_at").in("id", taskAssignmentIds)
      : { data: [] }

  const { data: tasksDirect } = await supabase
    .from("tasks")
    .select("id, title, status, project_id, created_at")
    .eq("assigned_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200)

  const tasks = [...(tasksDirect || []), ...(tasksFromAssignments || [])].reduce<Record<string, any>>((acc, t) => {
    acc[t.id] = t
    return acc
  }, {})

  const uniqueTasks = Object.values(tasks).sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1))

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">Internal</div>
          <h2 className="text-2xl font-semibold">Assignments</h2>
          <div className="mt-1 text-sm text-slate-400">Your assigned requests and tasks.</div>
        </div>
        <Link href="/workspace" className="text-sm text-slate-300 hover:text-white">
          Workspace
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Assigned Requests">
          <div className="divide-y divide-slate-800">
            {(requests || []).length ? (
              (requests || []).map((r) => (
                <Link key={r.id} href={`/workspace/intake/${r.id}`} className="block py-3 hover:bg-slate-950/40">
                  <div className="text-sm font-medium text-slate-100">{r.title}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {r.category} · {r.priority} · {r.status}
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-6 text-sm text-slate-400">No assigned requests.</div>
            )}
          </div>
        </Card>

        <Card title="Assigned Tasks">
          <div className="divide-y divide-slate-800">
            {uniqueTasks.length ? (
              uniqueTasks.map((t: any) => (
                <Link key={t.id} href={t.project_id ? `/projects/${t.project_id}` : "/tasks"} className="block py-3 hover:bg-slate-950/40">
                  <div className="text-sm font-medium text-slate-100">{t.title}</div>
                  <div className="mt-1 text-xs text-slate-400">{t.status}</div>
                </Link>
              ))
            ) : (
              <div className="py-6 text-sm text-slate-400">No assigned tasks.</div>
            )}
          </div>
        </Card>
      </div>
    </main>
  )
}


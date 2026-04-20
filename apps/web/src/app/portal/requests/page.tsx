import Link from "next/link"
import { redirect } from "next/navigation"

import { Card } from "@/components/Card"
import { supabaseServerClient } from "@/lib/supabase/server"

function badgeClass(status: string) {
  switch (status) {
    case "new":
      return "border-slate-700 bg-slate-900/40 text-slate-200"
    case "triaged":
      return "border-indigo-900/50 bg-indigo-950/40 text-indigo-200"
    case "in_progress":
      return "border-blue-900/50 bg-blue-950/40 text-blue-200"
    case "waiting_for_client":
      return "border-amber-900/50 bg-amber-950/40 text-amber-200"
    case "completed":
      return "border-emerald-900/50 bg-emerald-950/40 text-emerald-200"
    case "cancelled":
      return "border-red-900/50 bg-red-950/40 text-red-200"
    default:
      return "border-slate-800 bg-slate-950/50 text-slate-200"
  }
}

export default async function PortalRequestsPage() {
  const supabase = supabaseServerClient()
  if (!supabase) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Requests</h2>
        <div className="rounded-md border border-yellow-900 bg-yellow-950/40 p-4 text-sm text-yellow-200">
          Supabase is not configured.
        </div>
      </main>
    )
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from("profiles").select("role, primary_org_id").eq("id", user.id).maybeSingle()
    : { data: null }

  if (!user) {
    redirect("/portal/login")
  }

  if (profile?.role !== "client") {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Requests</h2>
        <div className="rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">Unauthorized</div>
      </main>
    )
  }

  const { data: requests } = await supabase
    .from("requests")
    .select("id, title, category, priority, status, created_at")
    .order("created_at", { ascending: false })

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">Client Portal</div>
          <h2 className="text-2xl font-semibold">Requests</h2>
        </div>
        <Link
          href="/portal/requests/new"
          className="inline-flex items-center justify-center rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-white"
        >
          New request
        </Link>
      </div>

      <Card title="History">
        <div className="divide-y divide-slate-800">
          {(requests || []).length ? (
            (requests || []).map((r) => (
              <Link
                key={r.id}
                href={`/portal/requests/${r.id}`}
                className="flex flex-col gap-2 py-4 hover:bg-slate-950/40 md:flex-row md:items-center md:justify-between md:gap-6"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-100">{r.title}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {r.category} · {r.priority} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div
                  className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs ${badgeClass(
                    r.status
                  )}`}
                >
                  {r.status}
                </div>
              </Link>
            ))
          ) : (
            <div className="py-8 text-sm text-slate-400">No requests yet.</div>
          )}
        </div>
      </Card>
    </main>
  )
}

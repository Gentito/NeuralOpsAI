import { redirect } from "next/navigation"

import { Card } from "@/components/Card"
import { supabaseServerClient } from "@/lib/supabase/server"

export default async function ApprovalsPage() {
  const supabase = supabaseServerClient()
  if (!supabase) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Approvals</h2>
        <div className="rounded-md border border-yellow-900 bg-yellow-950/40 p-4 text-sm text-yellow-200">Supabase is not configured.</div>
      </main>
    )
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect("/login?next=/dashboard/approvals")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = (profile?.role as string | undefined) || (user.user_metadata?.role as string | undefined) || null
  if (!role || role === "client") redirect("/portal")

  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, org_id, entity_type, entity_id, approval_type, status, payload, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100)

  const decide = async (formData: FormData) => {
    "use server"
    const supabase = supabaseServerClient()
    if (!supabase) return

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) redirect("/login?next=/dashboard/approvals")

    const id = String(formData.get("id") || "")
    const decision = String(formData.get("decision") || "")
    const reason = String(formData.get("reason") || "").trim()

    const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : null
    if (!id || !status) return

    await supabase
      .from("approvals")
      .update({ status, decided_by: user.id, decided_at: new Date().toISOString(), decision_reason: reason || null })
      .eq("id", id)

    if (status === "approved") {
      const { data: updated } = await supabase.from("approvals").select("org_id, entity_type, entity_id, approval_type").eq("id", id).single()
      if (updated?.approval_type === "client_update") {
        await supabase.from("automation_jobs").insert({
          org_id: updated.org_id,
          entity_type: updated.entity_type,
          entity_id: updated.entity_id,
          job_type: "publish_client_update",
          priority: 40,
          payload: { approvalId: id }
        })
      }
    }

    redirect("/dashboard/approvals")
  }

  return (
    <main className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-400">Leadership</div>
        <h2 className="text-2xl font-semibold">Approvals</h2>
        <div className="mt-1 text-sm text-slate-400">Review and approve client-facing updates and sensitive actions.</div>
      </div>

      <Card title="Pending">
        <div className="divide-y divide-slate-800">
          {(approvals || []).length ? (
            (approvals || []).map((a) => {
              const subject = a.payload?.subject ? String(a.payload.subject) : a.approval_type
              const message = a.payload?.message ? String(a.payload.message) : ""
              return (
                <div key={a.id} className="py-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-100">{subject}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {a.approval_type} · {a.entity_type}:{a.entity_id} · {new Date(a.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-slate-400">{a.status}</div>
                  </div>

                  {message ? (
                    <pre className="mt-4 overflow-auto rounded-md border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-200 whitespace-pre-wrap">
                      {message}
                    </pre>
                  ) : null}

                  <form action={decide} className="mt-4 grid gap-2 md:grid-cols-3 md:items-center">
                    <input type="hidden" name="id" value={a.id} />
                    <input
                      name="reason"
                      placeholder="Reason (optional)"
                      className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                    />
                    <button
                      name="decision"
                      value="approve"
                      className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                      type="submit"
                    >
                      Approve
                    </button>
                    <button
                      name="decision"
                      value="reject"
                      className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                      type="submit"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              )
            })
          ) : (
            <div className="py-8 text-sm text-slate-400">No pending approvals.</div>
          )}
        </div>
      </Card>
    </main>
  )
}


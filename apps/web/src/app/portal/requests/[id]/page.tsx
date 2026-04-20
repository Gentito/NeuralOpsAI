import Link from "next/link"
import { redirect } from "next/navigation"

import { Card } from "@/components/Card"
import { supabaseServerClient } from "@/lib/supabase/server"

export default async function PortalRequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServerClient()
  if (!supabase) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Request</h2>
        <div className="rounded-md border border-yellow-900 bg-yellow-950/40 p-4 text-sm text-yellow-200">
          Supabase is not configured.
        </div>
      </main>
    )
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect("/portal/login")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  if (profile?.role !== "client") redirect("/workspace")

  const requestId = params.id

  const { data: reqRow, error: reqError } = await supabase
    .from("requests")
    .select("id, title, description, category, priority, status, preferred_deadline, budget, created_at")
    .eq("id", requestId)
    .maybeSingle()

  if (reqError) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Request</h2>
        <div className="rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{reqError.message}</div>
      </main>
    )
  }

  if (!reqRow) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Request</h2>
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

  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, visibility, created_at, created_by")
    .eq("entity_type", "request")
    .eq("entity_id", requestId)
    .order("created_at", { ascending: true })

  const createComment = async (formData: FormData) => {
    "use server"
    const supabase = supabaseServerClient()
    if (!supabase) return

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) redirect("/login")

    const body = String(formData.get("body") || "").trim()
    if (!body) redirect(`/portal/requests/${requestId}`)

    const { data: profile } = await supabase.from("profiles").select("role, primary_org_id").eq("id", user.id).maybeSingle()
    if (!profile?.primary_org_id || profile.role !== "client") redirect("/workspace")

    await supabase.from("comments").insert({
      org_id: profile.primary_org_id,
      entity_type: "request",
      entity_id: requestId,
      visibility: "client",
      body,
      created_by: user.id
    })

    redirect(`/portal/requests/${requestId}`)
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">Client Portal</div>
          <h2 className="text-2xl font-semibold">{reqRow.title}</h2>
          <div className="mt-1 text-sm text-slate-400">
            {reqRow.category} · {reqRow.priority} · {reqRow.status} · {new Date(reqRow.created_at).toLocaleString()}
          </div>
        </div>
        <Link href="/portal/requests" className="text-sm text-slate-300 hover:text-white">
          Back to requests
        </Link>
      </div>

      <Card title="Details">
        <div className="space-y-3">
          <div className="whitespace-pre-wrap text-sm text-slate-200">{reqRow.description}</div>
          <div className="grid gap-2 text-sm text-slate-400 md:grid-cols-3">
            <div>Preferred deadline: {reqRow.preferred_deadline || "—"}</div>
            <div>Budget: {reqRow.budget == null ? "—" : `$${reqRow.budget}`}</div>
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

      <Card title="Messages">
        <form action={createComment} className="space-y-3">
          <textarea
            name="body"
            className="min-h-[110px] w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder="Send a message to the team…"
          />
          <div className="flex items-center justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-white"
            >
              Send
            </button>
          </div>
        </form>

        <div className="mt-6 divide-y divide-slate-800">
          {(comments || []).length ? (
            (comments || []).map((c) => (
              <div key={c.id} className="py-4">
                <div className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{c.body}</div>
              </div>
            ))
          ) : (
            <div className="py-6 text-sm text-slate-400">No messages yet.</div>
          )}
        </div>
      </Card>
    </main>
  )
}

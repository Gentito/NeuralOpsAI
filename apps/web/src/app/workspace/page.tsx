import { redirect } from "next/navigation"
import Link from "next/link"

import { Card } from "@/components/Card"
import { supabaseServerClient } from "@/lib/supabase/server"

export default async function WorkspacePage() {
  const supabase = supabaseServerClient()
  if (!supabase) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Workspace</h2>
        <div className="rounded-md border border-yellow-900 bg-yellow-950/40 p-4 text-sm text-yellow-200">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the server.
        </div>
      </main>
    )
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle()

  if (profile?.role === "client") redirect("/portal")

  return (
    <main className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-400">Internal</div>
        <h2 className="text-2xl font-semibold">Workspace</h2>
        <div className="mt-1 text-sm text-slate-400">{profile?.full_name || user.email}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Intake">
          <div className="text-sm text-slate-200">Review incoming client and email requests.</div>
          <Link
            href="/workspace/intake"
            className="mt-3 inline-flex items-center justify-center rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
          >
            Open intake
          </Link>
        </Card>
        <Card title="Assignments">
          <div className="text-sm text-slate-200">Pick up and execute assigned work.</div>
          <Link
            href="/workspace/assignments"
            className="mt-3 inline-flex items-center justify-center rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
          >
            View assignments
          </Link>
        </Card>
      </div>
    </main>
  )
}

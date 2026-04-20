import { redirect } from "next/navigation"
import Link from "next/link"

import { Card } from "@/components/Card"
import { supabaseServerClient } from "@/lib/supabase/server"

export default async function ClientPortalPage() {
  const supabase = supabaseServerClient()
  if (!supabase) {
    return (
      <main className="space-y-6">
        <h2 className="text-xl font-semibold">Client Portal</h2>
        <div className="rounded-md border border-yellow-900 bg-yellow-950/40 p-4 text-sm text-yellow-200">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the server.
        </div>
      </main>
    )
  }

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect("/portal/login")

  const { data: profile } = await supabase.from("profiles").select("full_name, company_name, role").eq("id", user.id).maybeSingle()

  if (profile?.role && profile.role !== "client") redirect("/workspace")

  return (
    <main className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-slate-400">Client Portal</div>
        <h2 className="text-2xl font-semibold">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h2>
        <div className="mt-1 text-sm text-slate-400">{profile?.company_name || user.email}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Requests">
          <div className="text-sm text-slate-200">Create and track service requests.</div>
          <Link
            href="/portal/requests"
            className="mt-3 inline-flex items-center justify-center rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
          >
            View requests
          </Link>
        </Card>
        <Card title="Messages">
          <div className="text-sm text-slate-200">Communicate with your assigned team.</div>
        </Card>
      </div>
    </main>
  )
}

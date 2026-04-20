import { redirect } from "next/navigation"

import { supabaseServerClient } from "@/lib/supabase/server"

import { DashboardClient } from "./DashboardClient"

export default async function DashboardPage() {
  const supabase = supabaseServerClient()
  if (!supabase) return <DashboardClient />

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) redirect("/login?next=/dashboard")

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
  const role = (profile?.role as string | undefined) || (user.user_metadata?.role as string | undefined) || null

  if (role === "client") redirect("/portal")

  return <DashboardClient />
}


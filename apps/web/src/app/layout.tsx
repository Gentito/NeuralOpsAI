import "./globals.css"

import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"

import { Logo } from "@/components/Logo"
import { supabaseServerClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "NeuralOps AI — Dashboard",
  description: "AI company operating dashboard"
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
      href={href}
    >
      {label}
    </Link>
  )
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const supabase = supabaseServerClient()
  const {
    data: { user }
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } }

  const { data: profile } =
    user && supabase ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null }

  const role = (profile?.role as string | undefined) || (user?.user_metadata?.role as string | undefined) || null

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        {role ? (
          <div className="mx-auto max-w-6xl px-4 py-10">
            <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Logo />
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-400">Operations</div>
                  <h1 className="text-2xl font-semibold">Company Dashboard</h1>
                </div>
              </div>
              <nav className="flex flex-wrap gap-2">
                {role === "client" ? (
                  <>
                    <NavLink href="/portal" label="Portal" />
                    <NavLink href="/portal/requests" label="Requests" />
                  </>
                ) : (
                  <>
                    <NavLink href="/dashboard" label="Dashboard" />
                    <NavLink href="/workspace" label="Workspace" />
                    <NavLink href="/projects" label="Projects" />
                    <NavLink href="/tasks" label="Tasks" />
                    <NavLink href="/clients" label="Clients" />
                    <NavLink href="/invoices" label="Invoices" />
                    <NavLink href="/chat" label="Chat" />
                  </>
                )}
                <NavLink href="/login" label="Account" />
              </nav>
            </header>
            {children}
          </div>
        ) : (
          <div>{children}</div>
        )}
      </body>
    </html>
  )
}

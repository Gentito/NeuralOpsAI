"use client"

import { useEffect, useMemo, useState } from "react"

import { Card } from "@/components/Card"
import { supabaseClient } from "@/lib/supabase"

export default function LoginPage() {
  const supabase = useMemo(() => supabaseClient(), [])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  async function refreshSession() {
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token || null
    if (token) window.localStorage.setItem("neuralops_access_token", token)
    else window.localStorage.removeItem("neuralops_access_token")
    setUserEmail(data.session?.user?.email || null)
  }

  useEffect(() => {
    if (!supabase) return
    refreshSession()
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const token = session?.access_token || null
      if (token) window.localStorage.setItem("neuralops_access_token", token)
      else window.localStorage.removeItem("neuralops_access_token")
      setUserEmail(session?.user?.email || null)
    })
    return () => data.subscription.unsubscribe()
  }, [supabase])

  async function signIn() {
    setStatus(null)
    if (!supabase) return
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setStatus(error.message)
      return
    }
    await refreshSession()
    setStatus("Signed in")
  }

  async function signUp() {
    setStatus(null)
    if (!supabase) return
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setStatus(error.message)
      return
    }
    setStatus("Sign-up successful. Check email if confirmation is enabled.")
    await refreshSession()
  }

  async function signOut() {
    setStatus(null)
    if (!supabase) return
    await supabase.auth.signOut()
    await refreshSession()
    setStatus("Signed out")
  }

  return (
    <main className="space-y-6">
      <h2 className="text-xl font-semibold">Login</h2>

      {!supabase ? (
        <div className="rounded-md border border-yellow-900 bg-yellow-950/40 p-4 text-sm text-yellow-200">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local, then restart the web
          server.
        </div>
      ) : null}

      {status ? (
        <div className="rounded-md border border-slate-800 bg-slate-950/50 p-4 text-sm text-slate-200">{status}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Account">
          <div className="text-sm text-slate-200">{userEmail ? `Signed in as ${userEmail}` : "Not signed in"}</div>
          <button
            className="mt-3 rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
            onClick={signOut}
            disabled={!userEmail}
          >
            Sign out
          </button>
        </Card>

        <Card title="Email + Password">
          <div className="space-y-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
                onClick={signIn}
              >
                Sign in
              </button>
              <button
                className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                onClick={signUp}
              >
                Sign up
              </button>
            </div>
          </div>
        </Card>
      </div>
    </main>
  )
}

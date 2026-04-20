"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { LogIn, UserPlus, LogOut, Mail, Lock, ShieldAlert, CheckCircle2 } from "lucide-react"

import { supabaseClient } from "@/lib/supabase"

export default function PortalLoginPage() {
  const supabase = useMemo(() => supabaseClient(), [])
  const [fullName, setFullName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<{ type: "error" | "success" | "info"; message: string } | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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

  async function signIn(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setStatus(null)
    setIsLoading(true)
    if (!supabase) {
      setIsLoading(false)
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setStatus({ type: "error", message: error.message })
      setIsLoading(false)
      return
    }
    await refreshSession()
    setStatus({ type: "success", message: "Signed in." })
    setIsLoading(false)
    window.location.href = "/portal"
  }

  async function signUp() {
    setStatus(null)
    setIsLoading(true)
    if (!supabase) {
      setIsLoading(false)
      return
    }
    if (!fullName.trim() || !companyName.trim()) {
      setStatus({ type: "error", message: "Full name and company name are required to create an account." })
      setIsLoading(false)
      return
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "client",
          full_name: fullName.trim(),
          company_name: companyName.trim()
        }
      }
    })
    if (error) {
      setStatus({ type: "error", message: error.message })
      setIsLoading(false)
      return
    }
    setStatus({ type: "success", message: "Account created. Check email if verification is enabled." })
    await refreshSession()
    setIsLoading(false)
  }

  async function signOut() {
    setStatus(null)
    setIsLoading(true)
    if (!supabase) {
      setIsLoading(false)
      return
    }
    await supabase.auth.signOut()
    await refreshSession()
    setStatus({ type: "info", message: "Signed out" })
    setIsLoading(false)
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="absolute inset-0 z-0">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] h-[70%] w-[50%] rounded-full bg-blue-900/20 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.15, 0.1], rotate: [0, -90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -right-[10%] h-[70%] w-[50%] rounded-full bg-indigo-900/20 blur-[120px]"
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">Client Portal</h2>
          <p className="mt-2 text-sm text-slate-400">Sign in to submit and track your requests</p>
        </div>

        {!supabase && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-4 text-sm text-yellow-200 backdrop-blur-sm">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
            <p>Supabase is not configured for this environment.</p>
          </div>
        )}

        {status && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-lg border p-4 text-sm backdrop-blur-sm
              ${status.type === "error" ? "border-red-900/50 bg-red-950/20 text-red-200" : ""}
              ${status.type === "success" ? "border-emerald-900/50 bg-emerald-950/20 text-emerald-200" : ""}
              ${status.type === "info" ? "border-blue-900/50 bg-blue-950/20 text-blue-200" : ""}
            `}
          >
            {status.type === "error" && <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />}
            {status.type !== "error" && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
            <p>{status.message}</p>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 shadow-2xl backdrop-blur-xl">
          {userEmail ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                <CheckCircle2 className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-white">Signed in</h3>
              <p className="mb-8 text-sm text-slate-400">{userEmail}</p>
              <div className="grid gap-2">
                <Link
                  href="/portal"
                  className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Continue
                </Link>
                <button
                  onClick={signOut}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8">
              <form onSubmit={signIn} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400" htmlFor="fullName">
                      Full name
                    </label>
                    <input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="block w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400" htmlFor="companyName">
                      Company
                    </label>
                    <input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="block w-full rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Acme Inc."
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400" htmlFor="email">
                    Email
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Mail className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-lg border border-slate-700 bg-slate-950/50 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="you@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400" htmlFor="password">
                    Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-4 w-4 text-slate-500" />
                    </div>
                    <input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-lg border border-slate-700 bg-slate-950/50 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !email || !password}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  <LogIn className="h-4 w-4" />
                  Sign in
                </button>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">Password must be at least 8 characters.</div>
                  <Link href="/forgot-password" className="text-xs text-slate-300 hover:text-white">
                    Forgot password?
                  </Link>
                </div>
              </form>

              <div className="relative mt-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-900 px-2 text-slate-400">New here?</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={signUp}
                  disabled={isLoading || !email || !password}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" />
                  Create account
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}


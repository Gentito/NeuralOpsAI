"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { LogIn, LogOut, Mail, Lock, ShieldAlert, CheckCircle2 } from "lucide-react"
import Link from "next/link"

import { supabaseClient } from "@/lib/supabase"

export default function LoginPage() {
  const supabase = useMemo(() => supabaseClient(), [])
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
    const { data: userRes } = await supabase.auth.getUser()
    const user = userRes.user
    let role = (user?.user_metadata?.role as string | undefined) || null
    if (!role && user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      role = (profile?.role as string | undefined) || null
    }
    if (role === "client") {
      setStatus({ type: "error", message: "This login is for internal leadership only. Use the Client Portal login." })
      await supabase.auth.signOut()
      await refreshSession()
      setIsLoading(false)
      return
    }
    setStatus({ type: "success", message: "Signed in." })
    setIsLoading(false)
    const next = new URLSearchParams(window.location.search).get("next")
    window.location.href = next || "/dashboard"
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
    setStatus({ type: "info", message: "You have been signed out." })
    setIsLoading(false)
  }

  return (
    <main className="relative min-h-[calc(100vh-12rem)] flex items-center justify-center overflow-hidden rounded-xl border border-slate-800/50 bg-slate-950">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] h-[70%] w-[50%] rounded-full bg-blue-900/20 blur-[120px]"
        />
        <motion.div
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.1, 0.15, 0.1],
            rotate: [0, -90, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -right-[10%] h-[70%] w-[50%] rounded-full bg-indigo-900/20 blur-[120px]"
        />
      </div>

      <div className="relative z-10 w-full max-w-md px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white">Leadership Login</h2>
          <p className="mt-2 text-sm text-slate-400">CEO and directors only</p>
        </motion.div>

        {!supabase && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mb-6 flex items-start gap-3 rounded-lg border border-yellow-900/50 bg-yellow-950/20 p-4 text-sm text-yellow-200 backdrop-blur-sm"
          >
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
            <p>Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local, then restart the server.</p>
          </motion.div>
        )}

        {status && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className={`mb-6 flex items-center gap-3 rounded-lg border p-4 text-sm backdrop-blur-sm
              ${status.type === 'error' ? 'border-red-900/50 bg-red-950/20 text-red-200' : ''}
              ${status.type === 'success' ? 'border-emerald-900/50 bg-emerald-950/20 text-emerald-200' : ''}
              ${status.type === 'info' ? 'border-blue-900/50 bg-blue-950/20 text-blue-200' : ''}
            `}
          >
            {status.type === 'error' && <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />}
            {status.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
            {status.type === 'info' && <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-500" />}
            <p>{status.message}</p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 shadow-2xl backdrop-blur-xl"
        >
          {userEmail ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                <CheckCircle2 className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-white">Signed in Successfully</h3>
              <p className="mb-8 text-sm text-slate-400">{userEmail}</p>
              
              <button
                onClick={signOut}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
              >
                {isLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="h-4 w-4 rounded-full border-2 border-slate-400 border-t-transparent" />
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-8">
              <form onSubmit={signIn} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400" htmlFor="email">Email</label>
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
                      className="block w-full rounded-lg border border-slate-700 bg-slate-950/50 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="you@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-400" htmlFor="password">Password</label>
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
                      className="block w-full rounded-lg border border-slate-700 bg-slate-950/50 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || !email || !password}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <>
                        <LogIn className="h-4 w-4" />
                        Sign in
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <Link href="/forgot-password" className="text-xs text-slate-300 hover:text-white">
                    Forgot password?
                  </Link>
                  <Link href="/portal/login" className="text-xs text-slate-400 hover:text-slate-200">
                    Client portal login
                  </Link>
                </div>
              </form>

              <div className="mt-6 text-center text-xs text-slate-500">
                New leadership accounts are provisioned by an administrator.
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  )
}

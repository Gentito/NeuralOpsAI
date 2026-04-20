"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Mail, ShieldAlert, CheckCircle2, ArrowLeft } from "lucide-react"
import Link from "next/link"

import { supabaseClient } from "@/lib/supabase"

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => supabaseClient(), [])
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function requestReset(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)
    setIsLoading(true)

    if (!supabase) {
      setIsLoading(false)
      setStatus({ type: "error", message: "Supabase is not configured." })
      return
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    if (error) {
      setStatus({ type: "error", message: error.message })
      setIsLoading(false)
      return
    }

    setStatus({ type: "success", message: "Password reset email sent. Check your inbox." })
    setIsLoading(false)
  }

  return (
    <main className="relative min-h-[calc(100vh-12rem)] flex items-center justify-center overflow-hidden rounded-xl border border-slate-800/50 bg-slate-950">
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

      <div className="relative z-10 w-full max-w-md px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white">Reset Password</h2>
          <p className="mt-2 text-sm text-slate-400">We’ll send you a secure password reset link</p>
        </motion.div>

        {status && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className={`mb-6 flex items-center gap-3 rounded-lg border p-4 text-sm backdrop-blur-sm ${
              status.type === "error"
                ? "border-red-900/50 bg-red-950/20 text-red-200"
                : "border-emerald-900/50 bg-emerald-950/20 text-emerald-200"
            }`}
          >
            {status.type === "error" ? (
              <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            )}
            <p>{status.message}</p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-900/40 shadow-2xl backdrop-blur-xl"
        >
          <div className="p-8">
            <form onSubmit={requestReset} className="space-y-5">
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
                    className="block w-full rounded-lg border border-slate-700 bg-slate-950/50 py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="you@company.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !email}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
              >
                {isLoading ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                  />
                ) : (
                  "Send reset link"
                )}
              </button>
            </form>

            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  )
}


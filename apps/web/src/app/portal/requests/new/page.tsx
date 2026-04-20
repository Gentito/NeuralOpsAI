"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Paperclip, ArrowLeft, ShieldAlert, CheckCircle2 } from "lucide-react"

import { supabaseClient } from "@/lib/supabase"
import { requestPrioritySchema, requestCreateSchema } from "@/lib/validation"

type Status = { type: "error" | "success" | "info"; message: string } | null

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

export default function NewRequestPage() {
  const router = useRouter()
  const supabase = useMemo(() => supabaseClient(), [])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("General")
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium")
  const [preferredDeadline, setPreferredDeadline] = useState("")
  const [budget, setBudget] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [status, setStatus] = useState<Status>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus(null)

    const budgetNumber = budget.trim().length ? Number(budget) : undefined
    const parsed = requestCreateSchema.safeParse({
      title,
      description,
      category,
      priority,
      preferredDeadline: preferredDeadline || undefined,
      budget: budgetNumber,
      contactEmail: contactEmail || undefined,
      contactPhone: contactPhone || undefined
    })

    if (!parsed.success) {
      setStatus({ type: "error", message: "Please check the form fields and try again." })
      return
    }

    setIsSubmitting(true)

    const res = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data)
    })

    const body = (await res.json().catch(() => null)) as any
    if (!res.ok) {
      setStatus({ type: "error", message: body?.error || "Failed to create request." })
      setIsSubmitting(false)
      return
    }

    const requestId = body?.request?.id as string | undefined
    if (!requestId) {
      setStatus({ type: "error", message: "Request created but missing id." })
      setIsSubmitting(false)
      return
    }

    if (!supabase) {
      setStatus({ type: "error", message: "Supabase is not configured." })
      setIsSubmitting(false)
      return
    }

    for (const file of attachments) {
      const prepRes = await fetch(`/api/requests/${requestId}/files/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originalName: file.name, mimeType: file.type || "application/octet-stream", size: file.size })
      })

      const prepBody = (await prepRes.json().catch(() => null)) as any
      if (!prepRes.ok) {
        setStatus({ type: "error", message: prepBody?.error || "Attachment validation failed." })
        setIsSubmitting(false)
        return
      }

      const bucket = prepBody?.bucket as string
      const storagePath = prepBody?.storagePath as string
      const safeName = prepBody?.originalName as string

      const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined
      })

      if (uploadError) {
        setStatus({ type: "error", message: uploadError.message })
        setIsSubmitting(false)
        return
      }

      const recordRes = await fetch(`/api/requests/${requestId}/files/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          originalName: safeName,
          mimeType: file.type || "application/octet-stream",
          size: file.size
        })
      })

      const recordBody = (await recordRes.json().catch(() => null)) as any
      if (!recordRes.ok) {
        setStatus({ type: "error", message: recordBody?.error || "Failed to record attachment." })
        setIsSubmitting(false)
        return
      }
    }

    setStatus({ type: "success", message: "Request submitted." })
    router.push(`/portal/requests/${requestId}`)
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">Client Portal</div>
          <h2 className="text-2xl font-semibold">New Request</h2>
        </div>
        <Link href="/portal/requests" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      {status ? (
        <div
          className={`flex items-center gap-3 rounded-lg border p-4 text-sm ${
            status.type === "error"
              ? "border-red-900/50 bg-red-950/20 text-red-200"
              : status.type === "success"
                ? "border-emerald-900/50 bg-emerald-950/20 text-emerald-200"
                : "border-blue-900/50 bg-blue-950/20 text-blue-200"
          }`}
        >
          {status.type === "error" ? (
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-500" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
          )}
          <div>{status.message}</div>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-6 rounded-xl border border-slate-800 bg-slate-950/40 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-200" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Short summary of what you need"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-200" htmlFor="category">
              Category
            </label>
            <input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="e.g. Website, Automation, Data, Operations"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-200" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[160px] w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            placeholder="Provide as much detail as possible"
            required
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm text-slate-200" htmlFor="priority">
              Priority
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => {
                const v = e.target.value
                const parsed = requestPrioritySchema.safeParse(v)
                if (parsed.success) setPriority(parsed.data)
              }}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-200" htmlFor="deadline">
              Preferred deadline
            </label>
            <input
              id="deadline"
              type="date"
              value={preferredDeadline}
              onChange={(e) => setPreferredDeadline(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-200" htmlFor="budget">
              Budget (optional)
            </label>
            <input
              id="budget"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="e.g. 1500"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-slate-200" htmlFor="contactEmail">
              Contact email (optional)
            </label>
            <input
              id="contactEmail"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="you@company.com"
              type="email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-200" htmlFor="contactPhone">
              Contact phone (optional)
            </label>
            <input
              id="contactPhone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="+1 555 123 4567"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-200">Attachments (optional)</label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900">
              <Paperclip className="h-4 w-4" />
              Add files
              <input
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.txt,.zip"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  setAttachments(files)
                }}
              />
            </label>
          </div>

          {attachments.length ? (
            <div className="divide-y divide-slate-800 rounded-md border border-slate-800">
              {attachments.map((f) => (
                <div key={`${f.name}-${f.size}`} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div className="min-w-0 truncate text-slate-200">{f.name}</div>
                  <div className="shrink-0 text-xs text-slate-400">{formatBytes(f.size)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-400">Allowed: PDF, DOCX, XLSX, PNG, JPG, TXT, ZIP. Max 25MB each.</div>
          )}
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-white disabled:opacity-50"
          >
            {isSubmitting ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                className="h-4 w-4 rounded-full border-2 border-slate-800 border-t-transparent"
              />
            ) : (
              "Submit request"
            )}
          </button>
        </div>
      </form>
    </main>
  )
}


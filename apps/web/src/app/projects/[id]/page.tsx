"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { Card } from "@/components/Card"
import { fetchJson } from "@/lib/api"

type AnyItem = Record<string, unknown>

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const projectId = params.id
  const [project, setProject] = useState<AnyItem | null>(null)
  const [tasks, setTasks] = useState<AnyItem[]>([])
  const [invoices, setInvoices] = useState<AnyItem[]>([])
  const [messages, setMessages] = useState<AnyItem[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const [p, t, i, m] = await Promise.all([
        fetchJson<AnyItem>(`/projects/${encodeURIComponent(projectId)}`),
        fetchJson<AnyItem[]>(`/tasks?projectId=${encodeURIComponent(projectId)}`),
        fetchJson<AnyItem[]>(`/invoices?projectId=${encodeURIComponent(projectId)}`),
        fetchJson<AnyItem[]>(`/chat/messages?projectId=${encodeURIComponent(projectId)}`)
      ])
      setProject(p)
      setTasks(t)
      setInvoices(i)
      setMessages(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    }
  }

  useEffect(() => {
    load()
  }, [projectId])

  const counts = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const t of tasks) {
      const s = String(t.status || "todo")
      byStatus[s] = (byStatus[s] || 0) + 1
    }
    return byStatus
  }, [tasks])

  async function createTask(form: FormData) {
    const title = String(form.get("title") || "").trim()
    const assignedTo = String(form.get("assignedTo") || "").trim()
    if (!title) return
    await fetchJson("/tasks", {
      method: "POST",
      body: JSON.stringify({ title, status: "todo", assignedTo: assignedTo || null, projectId })
    })
    await load()
  }

  async function orchestrate(form: FormData) {
    const objective = String(form.get("objective") || "").trim()
    if (!objective) return
    await fetchJson("/orchestrate", { method: "POST", body: JSON.stringify({ objective, projectId }) })
    await load()
  }

  async function sendMessage(form: FormData) {
    const agent = String(form.get("agent") || "Chief of Staff Agent")
    const message = String(form.get("message") || "").trim()
    if (!message) return
    await fetchJson("/chat", { method: "POST", body: JSON.stringify({ agent, message, projectId }) })
    await load()
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400">Project</div>
          <h2 className="text-xl font-semibold">{project ? String(project.name || project.id) : projectId}</h2>
        </div>
        <div className="flex gap-2">
          <Link
            className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
            href="/projects"
          >
            Back
          </Link>
          <button
            className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
            onClick={load}
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="To do">
          <div className="text-3xl font-semibold">{counts.todo || 0}</div>
        </Card>
        <Card title="Doing">
          <div className="text-3xl font-semibold">{counts.doing || 0}</div>
        </Card>
        <Card title="Blocked">
          <div className="text-3xl font-semibold">{counts.blocked || 0}</div>
        </Card>
        <Card title="Done">
          <div className="text-3xl font-semibold">{counts.done || 0}</div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Create Task">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              await createTask(form)
              e.currentTarget.reset()
            }}
          >
            <input
              name="title"
              placeholder="Task title"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              name="assignedTo"
              placeholder="Assigned to (optional)"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
            >
              Add task
            </button>
          </form>
        </Card>

        <Card title="Orchestrate">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              await orchestrate(form)
              e.currentTarget.reset()
            }}
          >
            <input
              name="objective"
              placeholder="Objective (creates tasks across agents)"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
            >
              Generate tasks
            </button>
          </form>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Tasks">
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={String(t.id)} className="rounded-md border border-slate-800 px-3 py-2">
                <div className="text-sm font-medium">{String(t.title || "")}</div>
                <div className="text-xs text-slate-400">
                  {String(t.status || "")}
                  {t.assignedTo ? ` · ${String(t.assignedTo)}` : ""}
                </div>
              </div>
            ))}
            {tasks.length === 0 ? <div className="text-sm text-slate-400">No tasks yet.</div> : null}
          </div>
          <div className="mt-3">
            <Link className="text-sm text-slate-200 hover:underline" href={`/tasks?projectId=${projectId}`}>
              Open tasks board
            </Link>
          </div>
        </Card>

        <Card title="Invoices">
          <div className="space-y-2">
            {invoices.slice(0, 8).map((inv) => (
              <div key={String(inv.id)} className="rounded-md border border-slate-800 px-3 py-2">
                <div className="text-sm font-medium">{String(inv.invoiceNumber || inv.id)}</div>
                <div className="text-xs text-slate-400">
                  {String(inv.status || "")} · {String(inv.currency || "")} {String(inv.total || "")}
                </div>
              </div>
            ))}
            {invoices.length === 0 ? <div className="text-sm text-slate-400">No invoices yet.</div> : null}
          </div>
          <div className="mt-3">
            <Link className="text-sm text-slate-200 hover:underline" href={`/invoices?projectId=${projectId}`}>
              Generate invoice
            </Link>
          </div>
        </Card>
      </div>

      <Card title="Chat">
        <form
          className="mb-4 grid gap-2 md:grid-cols-[240px_1fr_auto]"
          onSubmit={async (e) => {
            e.preventDefault()
            const form = new FormData(e.currentTarget)
            await sendMessage(form)
            e.currentTarget.reset()
          }}
        >
          <select
            name="agent"
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            defaultValue="Chief of Staff Agent"
          >
            <option value="Chief of Staff Agent">Chief of Staff Agent</option>
            <option value="Product Manager Agent">Product Manager Agent</option>
            <option value="UI/UX Designer Agent">UI/UX Designer Agent</option>
            <option value="Frontend Developer Agent">Frontend Developer Agent</option>
            <option value="Backend Developer Agent">Backend Developer Agent</option>
            <option value="QA/Test Agent">QA/Test Agent</option>
            <option value="DevOps Agent">DevOps Agent</option>
            <option value="CRM / Sales Agent">CRM / Sales Agent</option>
            <option value="Finance / Invoicing Agent">Finance / Invoicing Agent</option>
            <option value="Customer Support Agent">Customer Support Agent</option>
            <option value="Operations Manager Agent">Operations Manager Agent</option>
            <option value="HR / Recruiter Agent">HR / Recruiter Agent</option>
            <option value="Training & Policy Agent">Training & Policy Agent</option>
          </select>
          <input
            name="message"
            placeholder="Message"
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
          >
            Send
          </button>
        </form>

        <div className="space-y-2">
          {messages.map((m) => (
            <div key={String(m.id)} className="rounded-md border border-slate-800 px-3 py-2">
              <div className="text-xs text-slate-400">
                {String(m.role || "")} · {String(m.agent || "")}
              </div>
              <div className="whitespace-pre-wrap text-sm">{String(m.content || "")}</div>
            </div>
          ))}
          {messages.length === 0 ? <div className="text-sm text-slate-400">No messages yet.</div> : null}
        </div>
      </Card>
    </main>
  )
}


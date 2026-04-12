"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { Card } from "@/components/Card"
import { fetchJson } from "@/lib/api"

type AnyItem = Record<string, unknown>

export default function HomePage(): JSX.Element {
  const [agents, setAgents] = useState<AnyItem[]>([])
  const [projects, setProjects] = useState<AnyItem[]>([])
  const [tasks, setTasks] = useState<AnyItem[]>([])
  const [clients, setClients] = useState<AnyItem[]>([])
  const [invoices, setInvoices] = useState<AnyItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const counts = useMemo(
    () => ({
      agents: agents.length,
      projects: projects.length,
      tasks: tasks.length,
      clients: clients.length,
      invoices: invoices.length
    }),
    [agents.length, clients.length, invoices.length, projects.length, tasks.length]
  )

  async function loadAll() {
    setError(null)
    try {
      const [a, p, t, c, i] = await Promise.all([
        fetchJson<AnyItem[]>("/agents"),
        fetchJson<AnyItem[]>("/projects"),
        fetchJson<AnyItem[]>("/tasks"),
        fetchJson<AnyItem[]>("/clients"),
        fetchJson<AnyItem[]>("/invoices")
      ])
      setAgents(a)
      setProjects(p)
      setTasks(t)
      setClients(c)
      setInvoices(i)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function createTask(form: FormData) {
    const title = String(form.get("title") || "").trim()
    const assignedTo = String(form.get("assignedTo") || "").trim()
    const projectId = String(form.get("projectId") || "").trim()
    if (!title) return
    await fetchJson("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title,
        assignedTo: assignedTo || null,
        projectId: projectId || null,
        status: "todo"
      })
    })
    await loadAll()
  }

  async function createProject(form: FormData) {
    const name = String(form.get("name") || "").trim()
    if (!name) return
    await fetchJson("/projects", {
      method: "POST",
      body: JSON.stringify({ name, status: "active" })
    })
    await loadAll()
  }

  async function orchestrate(form: FormData) {
    const objective = String(form.get("objective") || "").trim()
    const projectId = String(form.get("projectId") || "").trim()
    if (!objective) return
    await fetchJson("/orchestrate", {
      method: "POST",
      body: JSON.stringify({ objective, projectId: projectId || null })
    })
    await loadAll()
  }

  return (
    <main className="space-y-6">
      {error ? (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <Card title="Agents">
          <Link className="text-3xl font-semibold hover:underline" href="/chat">
            {counts.agents}
          </Link>
        </Card>
        <Card title="Projects">
          <Link className="text-3xl font-semibold hover:underline" href="/projects">
            {counts.projects}
          </Link>
        </Card>
        <Card title="Tasks">
          <Link className="text-3xl font-semibold hover:underline" href="/tasks">
            {counts.tasks}
          </Link>
        </Card>
        <Card title="Clients">
          <Link className="text-3xl font-semibold hover:underline" href="/clients">
            {counts.clients}
          </Link>
        </Card>
        <Card title="Invoices">
          <Link className="text-3xl font-semibold hover:underline" href="/invoices">
            {counts.invoices}
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
            <select
              name="projectId"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">Project (optional)</option>
              {projects.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name || p.id)}
                </option>
              ))}
            </select>
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

        <Card title="Create Project">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              await createProject(form)
              e.currentTarget.reset()
            }}
          >
            <input
              name="name"
              placeholder="Project name"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
            >
              Create project
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
              placeholder="Objective (e.g. Build onboarding flow)"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <select
              name="projectId"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="">Project (optional)</option>
              {projects.map((p) => (
                <option key={String(p.id)} value={String(p.id)}>
                  {String(p.name || p.id)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
            >
              Create plan tasks
            </button>
          </form>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Recent Tasks">
          <ul className="space-y-2 text-sm">
            {tasks.slice(0, 8).map((t) => (
              <li key={String(t.id)} className="rounded-md border border-slate-800 px-3 py-2">
                <div className="font-medium">{String(t.title || "Untitled")}</div>
                <div className="text-xs text-slate-400">
                  {String(t.status || "")}
                  {t.assignedTo ? ` · ${String(t.assignedTo)}` : ""}
                </div>
              </li>
            ))}
            {tasks.length === 0 ? (
              <li className="text-slate-400">No tasks yet.</li>
            ) : null}
          </ul>
        </Card>

        <Card title="Agents">
          <ul className="space-y-2 text-sm">
            {agents.slice(0, 10).map((a) => (
              <li key={String(a.id)} className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2">
                <div>
                  <div className="font-medium">{String(a.name || "")}</div>
                  <div className="text-xs text-slate-400">{String(a.department || "")}</div>
                </div>
                <div className="text-xs text-slate-400">{String(a.role || "")}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  )
}

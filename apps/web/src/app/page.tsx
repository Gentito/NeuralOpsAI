"use client"

import { useEffect, useMemo, useState } from "react"

import { fetchJson } from "@/lib/api"

type AnyItem = Record<string, unknown>

function Card({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-5">
      <h2 className="mb-3 text-sm font-medium text-slate-200">{title}</h2>
      {children}
    </section>
  )
}

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
    if (!title) return
    await fetchJson("/tasks", {
      method: "POST",
      body: JSON.stringify({
        title,
        assignedTo: assignedTo || null,
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

  return (
    <main className="space-y-6">
      {error ? (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <Card title="Agents">
          <div className="text-3xl font-semibold">{counts.agents}</div>
        </Card>
        <Card title="Projects">
          <div className="text-3xl font-semibold">{counts.projects}</div>
        </Card>
        <Card title="Tasks">
          <div className="text-3xl font-semibold">{counts.tasks}</div>
        </Card>
        <Card title="Clients">
          <div className="text-3xl font-semibold">{counts.clients}</div>
        </Card>
        <Card title="Invoices">
          <div className="text-3xl font-semibold">{counts.invoices}</div>
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

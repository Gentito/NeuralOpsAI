"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

import { Card } from "@/components/Card"
import { fetchJson } from "@/lib/api"

type AnyItem = Record<string, unknown>

export default function ProjectsPage() {
  const [projects, setProjects] = useState<AnyItem[]>([])
  const [tasks, setTasks] = useState<AnyItem[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const [p, t] = await Promise.all([fetchJson<AnyItem[]>("/projects"), fetchJson<AnyItem[]>("/tasks")])
      setProjects(p)
      setTasks(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    }
  }

  useEffect(() => {
    load()
  }, [])

  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of tasks) {
      const pid = t.projectId ? String(t.projectId) : ""
      if (!pid) continue
      counts[pid] = (counts[pid] || 0) + 1
    }
    return counts
  }, [tasks])

  async function createProject(form: FormData) {
    const name = String(form.get("name") || "").trim()
    if (!name) return
    await fetchJson("/projects", { method: "POST", body: JSON.stringify({ name, status: "active" }) })
    await load()
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Projects</h2>
        <button
          className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
          onClick={load}
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
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
              Create
            </button>
          </form>
        </Card>

        <Card title="Active Projects">
          <div className="text-3xl font-semibold">{projects.length}</div>
          <div className="mt-2 text-xs text-slate-400">Total projects</div>
        </Card>

        <Card title="Tasks Linked">
          <div className="text-3xl font-semibold">{Object.keys(taskCounts).length}</div>
          <div className="mt-2 text-xs text-slate-400">Projects with tasks</div>
        </Card>
      </div>

      <Card title="All Projects">
        <div className="divide-y divide-slate-900">
          {projects.map((p) => (
            <div key={String(p.id)} className="flex flex-col gap-1 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <Link className="font-medium hover:underline" href={`/projects/${String(p.id)}`}>
                  {String(p.name || p.id)}
                </Link>
                <div className="text-xs text-slate-400">{String(p.status || "")}</div>
              </div>
              <div className="text-sm text-slate-300">{taskCounts[String(p.id)] || 0} tasks</div>
            </div>
          ))}
          {projects.length === 0 ? <div className="py-3 text-sm text-slate-400">No projects yet.</div> : null}
        </div>
      </Card>
    </main>
  )
}


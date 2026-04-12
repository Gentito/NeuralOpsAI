"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { Card } from "@/components/Card"
import { fetchJson } from "@/lib/api"

type AnyItem = Record<string, unknown>

const STATUSES = ["todo", "doing", "blocked", "done"] as const

function statusLabel(s: string) {
  if (s === "todo") return "To do"
  if (s === "doing") return "Doing"
  if (s === "blocked") return "Blocked"
  if (s === "done") return "Done"
  return s
}

export default function TasksClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tasks, setTasks] = useState<AnyItem[]>([])
  const [projects, setProjects] = useState<AnyItem[]>([])
  const [agents, setAgents] = useState<AnyItem[]>([])
  const [projectId, setProjectId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const [t, p, a] = await Promise.all([
        fetchJson<AnyItem[]>(projectId ? `/tasks?projectId=${encodeURIComponent(projectId)}` : "/tasks"),
        fetchJson<AnyItem[]>("/projects"),
        fetchJson<AnyItem[]>("/agents")
      ])
      setTasks(t)
      setProjects(p)
      setAgents(a)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    }
  }

  useEffect(() => {
    load()
  }, [projectId])

  useEffect(() => {
    const fromUrl = searchParams.get("projectId") || ""
    setProjectId(fromUrl)
  }, [searchParams])

  const byStatus = useMemo(() => {
    const map: Record<string, AnyItem[]> = {}
    for (const s of STATUSES) map[s] = []
    for (const t of tasks) {
      const s = String(t.status || "todo")
      if (!map[s]) map[s] = []
      map[s].push(t)
    }
    return map
  }, [tasks])

  async function setTaskStatus(taskId: string, status: string) {
    await fetchJson(`/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    })
    await load()
  }

  async function assignTask(taskId: string, assignedTo: string) {
    await fetchJson(`/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo })
    })
    await load()
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">Tasks</h2>
        <div className="flex gap-2">
          <select
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            value={projectId}
            onChange={(e) => {
              const next = e.target.value
              setProjectId(next)
              if (next) router.push(`/tasks?projectId=${encodeURIComponent(next)}`)
              else router.push("/tasks")
            }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.name || p.id)}
              </option>
            ))}
          </select>
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
        {STATUSES.map((s) => (
          <Card key={s} title={statusLabel(s)}>
            <div className="space-y-2">
              {(byStatus[s] || []).map((t) => (
                <div key={String(t.id)} className="rounded-md border border-slate-800 p-3">
                  <div className="mb-1 text-sm font-medium">{String(t.title || "Untitled")}</div>
                  <div className="mb-2 text-xs text-slate-400">
                    {t.projectId ? (
                      <Link className="hover:underline" href={`/projects/${String(t.projectId)}`}>
                        {String(t.projectId)}
                      </Link>
                    ) : (
                      <span>No project</span>
                    )}
                    {t.assignedTo ? ` · ${String(t.assignedTo)}` : ""}
                  </div>

                  <div className="mb-2 flex flex-wrap gap-1">
                    {STATUSES.filter((x) => x !== s).map((next) => (
                      <button
                        key={next}
                        className="rounded border border-slate-800 px-2 py-1 text-xs text-slate-200 hover:bg-slate-900"
                        onClick={() => setTaskStatus(String(t.id), next)}
                      >
                        {statusLabel(next)}
                      </button>
                    ))}
                  </div>

                  <select
                    className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1 text-xs"
                    value={String(t.assignedTo || "")}
                    onChange={(e) => assignTask(String(t.id), e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={String(a.id)} value={String(a.name || "")}>
                        {String(a.name || "")}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {(byStatus[s] || []).length === 0 ? <div className="text-sm text-slate-400">No tasks.</div> : null}
            </div>
          </Card>
        ))}
      </div>
    </main>
  )
}


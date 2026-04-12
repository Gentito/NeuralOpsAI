"use client"

import { useEffect, useState } from "react"

import { Card } from "@/components/Card"
import { fetchJson } from "@/lib/api"

type AnyItem = Record<string, unknown>

export default function ClientsPage() {
  const [clients, setClients] = useState<AnyItem[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const c = await fetchJson<AnyItem[]>("/clients")
      setClients(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function createClient(form: FormData) {
    const name = String(form.get("name") || "").trim()
    const email = String(form.get("email") || "").trim()
    if (!name) return
    await fetchJson("/clients", {
      method: "POST",
      body: JSON.stringify({ name, email: email || null, status: "active" })
    })
    await load()
  }

  async function deleteClient(id: string) {
    await fetchJson(`/clients/${encodeURIComponent(id)}`, { method: "DELETE" })
    await load()
  }

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Clients</h2>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Create Client">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              await createClient(form)
              e.currentTarget.reset()
            }}
          >
            <input
              name="name"
              placeholder="Client name"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              name="email"
              placeholder="Email (optional)"
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
            >
              Create client
            </button>
          </form>
        </Card>

        <Card title="All Clients">
          <div className="divide-y divide-slate-900">
            {clients.map((c) => (
              <div key={String(c.id)} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{String(c.name || c.id)}</div>
                  <div className="text-xs text-slate-400">
                    {c.email ? String(c.email) : "No email"} · {String(c.status || "")}
                  </div>
                </div>
                <button
                  className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                  onClick={() => deleteClient(String(c.id))}
                >
                  Delete
                </button>
              </div>
            ))}
            {clients.length === 0 ? <div className="py-3 text-sm text-slate-400">No clients yet.</div> : null}
          </div>
        </Card>
      </div>
    </main>
  )
}


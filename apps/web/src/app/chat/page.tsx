"use client"

import { useEffect, useState } from "react"

import { Card } from "@/components/Card"
import { fetchJson } from "@/lib/api"

type AnyItem = Record<string, unknown>

const AGENTS = [
  "Chief of Staff Agent",
  "Product Manager Agent",
  "UI/UX Designer Agent",
  "Frontend Developer Agent",
  "Backend Developer Agent",
  "QA/Test Agent",
  "DevOps Agent",
  "CRM / Sales Agent",
  "Finance / Invoicing Agent",
  "Customer Support Agent",
  "Operations Manager Agent",
  "HR / Recruiter Agent",
  "Training & Policy Agent"
] as const

export default function ChatPage() {
  const [projects, setProjects] = useState<AnyItem[]>([])
  const [projectId, setProjectId] = useState<string>("")
  const [agent, setAgent] = useState<string>("Chief of Staff Agent")
  const [messages, setMessages] = useState<AnyItem[]>([])
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const p = await fetchJson<AnyItem[]>("/projects")
      setProjects(p)
      const url = projectId ? `/chat/messages?projectId=${encodeURIComponent(projectId)}` : "/chat/messages"
      const m = await fetchJson<AnyItem[]>(url)
      setMessages(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    }
  }

  useEffect(() => {
    load()
  }, [projectId])

  async function send(form: FormData) {
    const text = String(form.get("message") || "").trim()
    if (!text) return
    await fetchJson("/chat", {
      method: "POST",
      body: JSON.stringify({ agent, message: text, projectId: projectId || null })
    })
    await load()
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">Chat</h2>
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
        <Card title="Conversation">
          <select
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">Global</option>
            {projects.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.name || p.id)}
              </option>
            ))}
          </select>
          <div className="mt-2 text-xs text-slate-400">
            {projectId ? `Project: ${projectId}` : "No project selected"}
          </div>
        </Card>

        <Card title="Agent">
          <select
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
          >
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <div className="mt-2 text-xs text-slate-400">Messages are stored and visible in project detail too.</div>
        </Card>

        <Card title="Send">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const form = new FormData(e.currentTarget)
              await send(form)
              e.currentTarget.reset()
            }}
          >
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
        </Card>
      </div>

      <Card title="Messages">
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


"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

import { Card } from "@/components/Card"
import { fetchJson } from "@/lib/api"

type AnyItem = Record<string, unknown>

type LineItem = {
  description: string
  qty: number
  unitPrice: number
}

function toNumber(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function InvoicesClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [clients, setClients] = useState<AnyItem[]>([])
  const [projects, setProjects] = useState<AnyItem[]>([])
  const [invoices, setInvoices] = useState<AnyItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const [clientId, setClientId] = useState("")
  const [projectId, setProjectId] = useState("")

  const [currency, setCurrency] = useState("USD")
  const [taxRate, setTaxRate] = useState(0)
  const [paymentTerms, setPaymentTerms] = useState("Net 14")
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: "Service", qty: 1, unitPrice: 0 }])

  useEffect(() => {
    setClientId(searchParams.get("clientId") || "")
    setProjectId(searchParams.get("projectId") || "")
  }, [searchParams])

  async function load() {
    setError(null)
    try {
      const [c, p] = await Promise.all([fetchJson<AnyItem[]>("/clients"), fetchJson<AnyItem[]>("/projects")])
      setClients(c)
      setProjects(p)

      const qs: string[] = []
      if (clientId) qs.push(`clientId=${encodeURIComponent(clientId)}`)
      if (projectId) qs.push(`projectId=${encodeURIComponent(projectId)}`)
      const url = qs.length ? `/invoices?${qs.join("&")}` : "/invoices"
      const inv = await fetchJson<AnyItem[]>(url)
      setInvoices(inv)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error")
    }
  }

  useEffect(() => {
    load()
  }, [clientId, projectId])

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, li) => sum + li.qty * li.unitPrice, 0)
    const taxAmount = subtotal * Math.max(taxRate, 0)
    const total = subtotal + taxAmount
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100
    }
  }, [lineItems, taxRate])

  function syncUrl(nextClientId: string, nextProjectId: string) {
    const qs: string[] = []
    if (nextClientId) qs.push(`clientId=${encodeURIComponent(nextClientId)}`)
    if (nextProjectId) qs.push(`projectId=${encodeURIComponent(nextProjectId)}`)
    router.push(qs.length ? `/invoices?${qs.join("&")}` : "/invoices")
  }

  async function generateInvoice() {
    await fetchJson("/invoices/generate", {
      method: "POST",
      body: JSON.stringify({
        clientId: clientId || null,
        projectId: projectId || null,
        currency,
        taxRate,
        paymentTerms,
        lineItems
      })
    })
    setLineItems([{ description: "Service", qty: 1, unitPrice: 0 }])
    await load()
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-xl font-semibold">Invoices</h2>
        <div className="flex gap-2">
          <select
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            value={clientId}
            onChange={(e) => {
              const next = e.target.value
              setClientId(next)
              syncUrl(next, projectId)
            }}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {String(c.name || c.id)}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            value={projectId}
            onChange={(e) => {
              const next = e.target.value
              setProjectId(next)
              syncUrl(clientId, next)
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Generate Invoice">
          <div className="grid gap-2 md:grid-cols-3">
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Currency"
            />
            <input
              value={String(taxRate)}
              onChange={(e) => setTaxRate(toNumber(e.target.value))}
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Tax rate (0.1)"
            />
            <input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              placeholder="Payment terms"
            />
          </div>

          <div className="mt-4 space-y-2">
            {lineItems.map((li, idx) => (
              <div key={idx} className="grid gap-2 md:grid-cols-[1fr_90px_110px_auto]">
                <input
                  value={li.description}
                  onChange={(e) => {
                    const next = [...lineItems]
                    next[idx] = { ...next[idx], description: e.target.value }
                    setLineItems(next)
                  }}
                  className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Description"
                />
                <input
                  value={String(li.qty)}
                  onChange={(e) => {
                    const next = [...lineItems]
                    next[idx] = { ...next[idx], qty: toNumber(e.target.value) }
                    setLineItems(next)
                  }}
                  className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Qty"
                />
                <input
                  value={String(li.unitPrice)}
                  onChange={(e) => {
                    const next = [...lineItems]
                    next[idx] = { ...next[idx], unitPrice: toNumber(e.target.value) }
                    setLineItems(next)
                  }}
                  className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Unit price"
                />
                <button
                  className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                  onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}
                  disabled={lineItems.length === 1}
                >
                  Remove
                </button>
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
                onClick={() => setLineItems([...lineItems, { description: "", qty: 1, unitPrice: 0 }])}
              >
                Add line
              </button>
              <div className="text-sm text-slate-200">
                Subtotal {totals.subtotal} · Tax {totals.taxAmount} · Total {totals.total}
              </div>
            </div>

            <button
              className="mt-2 rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
              onClick={generateInvoice}
            >
              Generate
            </button>
          </div>
        </Card>

        <Card title="Invoices List">
          <div className="space-y-2">
            {invoices.slice(0, 20).map((inv) => (
              <div key={String(inv.id)} className="rounded-md border border-slate-800 px-3 py-2">
                <div className="text-sm font-medium">{String(inv.invoiceNumber || inv.id)}</div>
                <div className="text-xs text-slate-400">
                  {String(inv.status || "")}
                  {inv.clientId ? ` · client ${String(inv.clientId)}` : ""}
                  {inv.projectId ? ` · project ${String(inv.projectId)}` : ""}
                </div>
                <div className="text-sm text-slate-200">
                  {String(inv.currency || "")} {String(inv.total || "")}
                </div>
              </div>
            ))}
            {invoices.length === 0 ? <div className="text-sm text-slate-400">No invoices yet.</div> : null}
          </div>
        </Card>
      </div>
    </main>
  )
}


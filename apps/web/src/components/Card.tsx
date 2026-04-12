import type { ReactNode } from "react"

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/50 p-5">
      <h2 className="mb-3 text-sm font-medium text-slate-200">{title}</h2>
      {children}
    </section>
  )
}


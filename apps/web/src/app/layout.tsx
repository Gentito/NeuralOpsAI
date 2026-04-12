import "./globals.css"

import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"

export const metadata: Metadata = {
  title: "NeuralOps AI — Dashboard",
  description: "AI company operating dashboard"
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
      href={href}
    >
      {label}
    </Link>
  )
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400">NeuralOps AI</div>
              <h1 className="text-2xl font-semibold">Company Dashboard</h1>
            </div>
            <nav className="flex flex-wrap gap-2">
              <NavLink href="/" label="Home" />
              <NavLink href="/projects" label="Projects" />
              <NavLink href="/tasks" label="Tasks" />
              <NavLink href="/clients" label="Clients" />
              <NavLink href="/invoices" label="Invoices" />
              <NavLink href="/chat" label="Chat" />
              <NavLink href="/login" label="Login" />
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}

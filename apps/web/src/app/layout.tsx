import "./globals.css"

import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "NeuralOps AI — Dashboard",
  description: "AI company operating dashboard"
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <header className="mb-8 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-slate-400">NeuralOps AI</div>
              <h1 className="text-2xl font-semibold">Company Dashboard</h1>
            </div>
            <a
              className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
              href="/"
            >
              Home
            </a>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}


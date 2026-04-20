"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion"
import { ArrowRight, CheckCircle2, Eye, Layers, Rocket, ShieldCheck, Sparkles, Workflow } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Logo } from "@/components/Logo"
import { KpiCounter } from "@/components/marketing/KpiCounter"

const Hero3D = dynamic(() => import("@/components/marketing/Hero3D").then((m) => m.Hero3D), { ssr: false })

type Vec3 = [number, number, number]

type StorySection = {
  id: string
  eyebrow: string
  title: string
  body: string
  bullets: string[]
  kpis: Array<{ label: string; value: number; suffix?: string; prefix?: string; decimals?: number }>
  camera: { position: Vec3; lookAt: Vec3 }
  mood: { bg: string; orb: string; sparkles: string; ring: { a: string; b: string; c: string } }
  gradient: { a: string; b: string; c: string }
}

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

function hexToRgb(hex: string) {
  const h = hex.replace("#", "").trim()
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function lerpHex(a: string, b: string, t: number) {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const r = Math.round(lerp(ca.r, cb.r, t))
  const g = Math.round(lerp(ca.g, cb.g, t))
  const bl = Math.round(lerp(ca.b, cb.b, t))
  return `rgb(${r}, ${g}, ${bl})`
}

function moodOpacity(sectionIndex: number, t: number) {
  const d = Math.abs(t - sectionIndex)
  return clamp(1 - d)
}

export function MarketingHome() {
  const [introDone, setIntroDone] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [storyProgress, setStoryProgress] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const storyRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: rootRef, offset: ["start start", "end end"] })
  const progress = useTransform(scrollYProgress, [0, 1], [0, 1])

  useMotionValueEvent(scrollYProgress, "change", (v) => setScrollProgress(v))

  const { scrollYProgress: storyY } = useScroll({ target: storyRef, offset: ["start center", "end center"] })
  useMotionValueEvent(storyY, "change", (v) => setStoryProgress(v))

  useEffect(() => {
    const id = window.setTimeout(() => setIntroDone(true), 1400)
    return () => window.clearTimeout(id)
  }, [])

  const STORY = useMemo<StorySection[]>(
    () => [
      {
        id: "intake",
        eyebrow: "Intake",
        title: "Client requests become structured work within seconds.",
        body: "A premium client experience that captures what matters: goals, context, priority, deadlines, and supporting files—without back-and-forth.",
        bullets: ["Guided request intake", "Attachments and deadlines", "Client-visible progress and messaging"],
        kpis: [
          { label: "Submission time", value: 2.3, suffix: "m", decimals: 1 },
          { label: "First response SLA", value: 15, suffix: "m" },
          { label: "Intake accuracy", value: 97, suffix: "%" }
        ],
        camera: { position: [0.25, 0.7, 5.3], lookAt: [0, 0, 0] },
        mood: {
          bg: "#050816",
          orb: "#60a5fa",
          sparkles: "#93c5fd",
          ring: { a: "#a78bfa", b: "#60a5fa", c: "#22c55e" }
        },
        gradient: { a: "rgba(59,130,246,0.18)", b: "rgba(167,139,250,0.14)", c: "rgba(34,197,94,0.10)" }
      },
      {
        id: "pipeline",
        eyebrow: "Workflow",
        title: "Convert intake into projects, templates, and execution lanes.",
        body: "Turn a request into a project with templated tasks and clear ownership. Agents move faster when the system is structured.",
        bullets: ["Project + task templates", "Assignments and deadlines", "Operational views for teams"],
        kpis: [
          { label: "Auto tasks", value: 12, suffix: "+" },
          { label: "Cycle time", value: 38, suffix: "%", prefix: "↓" },
          { label: "On-time rate", value: 92, suffix: "%" }
        ],
        camera: { position: [-0.5, 0.9, 4.6], lookAt: [0, 0.05, 0] },
        mood: {
          bg: "#06061a",
          orb: "#a78bfa",
          sparkles: "#c4b5fd",
          ring: { a: "#60a5fa", b: "#a78bfa", c: "#22c55e" }
        },
        gradient: { a: "rgba(167,139,250,0.22)", b: "rgba(59,130,246,0.10)", c: "rgba(34,197,94,0.10)" }
      },
      {
        id: "oversight",
        eyebrow: "Leadership",
        title: "CEO and directors stay in the loop—without slowing delivery.",
        body: "Approvals and high-impact reviews are designed as a clean workflow: visible, intentional, and always traceable.",
        bullets: ["Leadership dashboard", "Approvals and review points", "Client-facing updates with controls"],
        kpis: [
          { label: "Review time", value: 6.5, suffix: "m", decimals: 1 },
          { label: "Rework rate", value: 24, suffix: "%", prefix: "↓" },
          { label: "Client satisfaction", value: 4.8, suffix: "/5", decimals: 1 }
        ],
        camera: { position: [0.9, 0.65, 4.2], lookAt: [0.1, 0, 0] },
        mood: {
          bg: "#070515",
          orb: "#22c55e",
          sparkles: "#86efac",
          ring: { a: "#a78bfa", b: "#22c55e", c: "#60a5fa" }
        },
        gradient: { a: "rgba(34,197,94,0.16)", b: "rgba(99,102,241,0.12)", c: "rgba(167,139,250,0.14)" }
      },
      {
        id: "audit",
        eyebrow: "Trust",
        title: "Every action is logged. Every file is permissioned.",
        body: "The system is designed for real operations. Audit trails, status history, and secure access are built in—not bolted on.",
        bullets: ["Audit logs and status history", "Signed attachment downloads", "Org isolation via RLS policies"],
        kpis: [
          { label: "Audit coverage", value: 100, suffix: "%" },
          { label: "Zero-trust access", value: 1, suffix: "st", prefix: "" },
          { label: "Secure downloads", value: 60, suffix: "s" }
        ],
        camera: { position: [0.2, 1.15, 3.85], lookAt: [0, 0.1, 0] },
        mood: {
          bg: "#05070f",
          orb: "#60a5fa",
          sparkles: "#a5b4fc",
          ring: { a: "#22c55e", b: "#60a5fa", c: "#a78bfa" }
        },
        gradient: { a: "rgba(15,23,42,0.22)", b: "rgba(96,165,250,0.14)", c: "rgba(167,139,250,0.10)" }
      }
    ],
    []
  )

  const t = clamp(storyProgress) * (STORY.length - 1)
  const i = Math.floor(t)
  const local = t - i
  const a = STORY[Math.min(i, STORY.length - 1)]
  const b = STORY[Math.min(i + 1, STORY.length - 1)]

  const camera = useMemo(() => {
    return {
      position: lerpVec(a.camera.position, b.camera.position, local),
      lookAt: lerpVec(a.camera.lookAt, b.camera.lookAt, local)
    }
  }, [a.camera.lookAt, a.camera.position, b.camera.lookAt, b.camera.position, local])

  const mood = useMemo(() => {
    return {
      bg: lerpHex(a.mood.bg, b.mood.bg, local),
      orb: lerpHex(a.mood.orb, b.mood.orb, local),
      sparkles: lerpHex(a.mood.sparkles, b.mood.sparkles, local),
      ring: {
        a: lerpHex(a.mood.ring.a, b.mood.ring.a, local),
        b: lerpHex(a.mood.ring.b, b.mood.ring.b, local),
        c: lerpHex(a.mood.ring.c, b.mood.ring.c, local)
      }
    }
  }, [a.mood.bg, a.mood.orb, a.mood.ring.a, a.mood.ring.b, a.mood.ring.c, a.mood.sparkles, b.mood.bg, b.mood.orb, b.mood.ring.a, b.mood.ring.b, b.mood.ring.c, b.mood.sparkles, local])

  return (
    <main ref={rootRef} className="min-h-screen bg-slate-950 text-slate-100">
      <div className="fixed inset-0 -z-10 bg-slate-950" />
      {STORY.map((s, idx) => (
        <div
          key={s.id}
          className="pointer-events-none fixed inset-0 -z-10 transition-opacity duration-500"
          style={{
            opacity: moodOpacity(idx, t),
            background:
              `radial-gradient(900px circle at 50% -120px, ${s.gradient.b}, transparent 55%),` +
              `radial-gradient(900px circle at 10% 30%, ${s.gradient.c}, transparent 60%),` +
              `radial-gradient(900px circle at 90% 40%, ${s.gradient.a}, transparent 60%)`
          }}
        />
      ))}
      {!introDone ? (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.55, delay: 0.95 }}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center bg-[#030611]"
        >
          <motion.div
            initial={{ scale: 0.86, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="rounded-2xl border border-slate-800/80 bg-slate-950/80 px-6 py-4 backdrop-blur"
          >
            <Logo size={34} />
          </motion.div>
        </motion.div>
      ) : null}
      <motion.div style={{ scaleX: progress }} className="fixed left-0 top-0 z-50 h-0.5 w-full origin-left bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400" />

      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link
            href="/portal"
            className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900/50"
          >
            Client Portal
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-white"
          >
            CEO Login
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-20 pt-8 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/40 px-4 py-2 text-xs text-slate-200"
          >
            <Sparkles className="h-4 w-4 text-blue-300" />
            AI-powered delivery with human-grade oversight
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-4xl font-semibold tracking-tight text-white sm:text-5xl"
          >
            Build, ship, and scale with a{" "}
            <span className="bg-gradient-to-r from-blue-300 via-violet-300 to-emerald-300 bg-clip-text text-transparent">
              NeuralOps AI
            </span>{" "}
            operating system.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="max-w-xl text-base leading-relaxed text-slate-300"
          >
            Clients submit requests. Internal agents execute. Leadership reviews approvals and critical decisions. Everything stays
            auditable, secure, and fast.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              href="/portal/requests/new"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500"
            >
              Submit a request
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/portal"
              className="inline-flex items-center justify-center rounded-md border border-slate-800 bg-slate-950/40 px-5 py-3 text-sm text-slate-200 hover:bg-slate-900/50"
            >
              Explore client portal
            </Link>
          </motion.div>

          <div className="grid gap-3 pt-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <ShieldCheck className="h-4 w-4 text-emerald-300" />
                Secure by design
              </div>
              <div className="mt-2 text-xs leading-relaxed text-slate-400">Org isolation, RLS, signed downloads, audit logs.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <Workflow className="h-4 w-4 text-blue-300" />
                Intake → delivery
              </div>
              <div className="mt-2 text-xs leading-relaxed text-slate-400">Requests convert into projects and tasks with templates.</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <Sparkles className="h-4 w-4 text-violet-300" />
                High-signal updates
              </div>
              <div className="mt-2 text-xs leading-relaxed text-slate-400">Clients and internal teams collaborate with visibility controls.</div>
            </div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.1 }}>
          <Hero3D progress={clamp(storyProgress)} camera={camera} mood={mood} />
        </motion.div>
      </section>

      <section ref={storyRef} className="mx-auto max-w-7xl px-6 pb-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
          <div className="space-y-10">
            {STORY.map((s, idx) => (
              <section key={s.id} id={s.id} className="min-h-[82vh] scroll-mt-24">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.55 }}
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-7 backdrop-blur"
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/40 px-3 py-1 text-xs text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    {s.eyebrow}
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{s.title}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{s.body}</p>

                  <ul className="mt-5 space-y-2 text-sm text-slate-300">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {s.kpis.map((k) => (
                      <div key={k.label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                        <KpiCounter value={k.value} suffix={k.suffix} prefix={k.prefix} decimals={k.decimals} />
                        <div className="mt-2 text-xs text-slate-400">{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {idx === 0 ? (
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <Link
                        href="/portal/requests/new"
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-500"
                      >
                        Submit a request
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <Link
                        href="/portal"
                        className="inline-flex items-center justify-center rounded-md border border-slate-800 bg-slate-950/40 px-5 py-3 text-sm text-slate-200 hover:bg-slate-900/50"
                      >
                        Explore client portal
                      </Link>
                    </div>
                  ) : null}
                </motion.div>
              </section>
            ))}
          </div>

          <div className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4 backdrop-blur">
              <div className="text-xs uppercase tracking-widest text-slate-400">Live Scene</div>
              <div className="mt-1 text-sm text-slate-200">{a.eyebrow}</div>
              <div className="mt-4">
                <Hero3D progress={clamp(storyProgress)} camera={camera} mood={mood} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="text-sm font-medium text-slate-100">For clients</div>
            <div className="mt-2 text-sm leading-relaxed text-slate-300">
              Submit a request with files, track progress, and message the team. Everything stays private to your organization.
            </div>
          </div>
          <div className="flex items-center justify-start lg:justify-end">
            <Link
              href="/portal/requests"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-5 py-3 text-sm text-slate-200 hover:bg-slate-900/50"
            >
              View requests
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl items-center justify-between px-6 pb-10 text-xs text-slate-500">
        <div>© {new Date().getFullYear()} NeuralOps AI</div>
        <div className="flex items-center gap-4">
          <Link href="/portal" className="hover:text-slate-300">
            Client Portal
          </Link>
          <Link href="/login" className="hover:text-slate-300">
            CEO Login
          </Link>
        </div>
      </footer>
    </main>
  )
}

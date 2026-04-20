"use client"

import { useEffect, useMemo, useRef, useState } from "react"

function useInViewOnce<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!ref.current || inView) return
    const el = ref.current
    const obs = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (entry?.isIntersecting) {
        setInView(true)
        obs.disconnect()
      }
    }, options)
    obs.observe(el)
    return () => obs.disconnect()
  }, [inView, options])

  return { ref, inView }
}

export function KpiCounter({
  value,
  suffix,
  prefix,
  decimals = 0,
  durationMs = 900
}: {
  value: number
  suffix?: string
  prefix?: string
  decimals?: number
  durationMs?: number
}) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>({ threshold: 0.35 })
  const [display, setDisplay] = useState(0)

  const formatter = useMemo(() => {
    const nf = new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
    return (n: number) => nf.format(n)
  }, [decimals])

  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    const from = 0
    const to = value

    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [durationMs, inView, value])

  return (
    <div ref={ref} className="tabular-nums">
      <span className="text-3xl font-semibold tracking-tight text-white">
        {prefix || ""}
        {formatter(display)}
        {suffix || ""}
      </span>
    </div>
  )
}


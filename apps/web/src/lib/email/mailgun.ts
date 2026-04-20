import { createHmac, timingSafeEqual } from "crypto"

export function verifyMailgunSignature(params: { timestamp: string; token: string; signature: string }, signingKey: string) {
  const { timestamp, token, signature } = params
  if (!timestamp || !token || !signature) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > 60 * 10) return false

  const digest = createHmac("sha256", signingKey).update(timestamp + token).digest("hex")

  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  } catch {
    return false
  }
}

export function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const v of values) {
    if (v && v.trim()) return v.trim()
  }
  return ""
}


type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

export async function llmJson<T>({
  messages,
  schemaHint,
  timeoutMs = 25000
}: {
  messages: ChatMessage[]
  schemaHint: string
  timeoutMs?: number
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY || ""
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini"

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Return ONLY valid JSON. Output must match this schema: ${schemaHint}` },
          ...messages
        ]
      }),
      signal: controller.signal
    })

    const json = (await res.json().catch(() => null)) as any
    if (!res.ok) {
      const msg = json?.error?.message || `LLM error (${res.status})`
      throw new Error(msg)
    }

    const content = json?.choices?.[0]?.message?.content
    if (!content || typeof content !== "string") throw new Error("LLM returned empty content")

    try {
      return JSON.parse(content) as T
    } catch {
      throw new Error("LLM returned non-JSON content")
    }
  } finally {
    clearTimeout(t)
  }
}


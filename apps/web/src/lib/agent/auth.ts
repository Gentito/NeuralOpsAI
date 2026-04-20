import { createHash } from "crypto"

import { supabaseAdminClient } from "@/lib/supabase/admin"

export type SystemActorAuth = {
  actor: {
    id: string
    orgId: string
    kind: string
    name: string
    status: string
    permissions: any
  }
  tokenId: string
}

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

export async function authenticateSystemActor(request: Request): Promise<SystemActorAuth> {
  const auth = request.headers.get("authorization") || ""
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  if (!token) throw new Error("Missing bearer token")

  const supabase = supabaseAdminClient()
  if (!supabase) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")

  const tokenHash = sha256Hex(token)

  const { data: row, error } = await supabase
    .from("system_actor_tokens")
    .select("id, status, expires_at, actor:system_actors(id, org_id, kind, name, status, permissions)")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (error) throw new Error(error.message)
  const actor = Array.isArray((row as any)?.actor) ? (row as any).actor[0] : (row as any)?.actor
  if (!row?.id || !actor?.id) throw new Error("Invalid token")
  if (row.status !== "active" || actor.status !== "active") throw new Error("Token disabled")
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) throw new Error("Token expired")

  await supabase.from("system_actor_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id)

  return {
    tokenId: row.id as string,
    actor: {
      id: actor.id as string,
      orgId: actor.org_id as string,
      kind: actor.kind as string,
      name: actor.name as string,
      status: actor.status as string,
      permissions: actor.permissions
    }
  }
}

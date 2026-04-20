import { supabaseAdminClient } from "@/lib/supabase/admin"

export async function logAgentAction(params: {
  orgId: string
  actorId: string
  entityType: "request" | "project" | "task"
  entityId: string
  action: string
  reversible?: boolean
  reversalOf?: string | null
  metadata?: any
}) {
  const supabase = supabaseAdminClient()
  if (!supabase) return

  await supabase.from("agent_action_logs").insert({
    org_id: params.orgId,
    actor_id: params.actorId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    reversible: !!params.reversible,
    reversal_of: params.reversalOf ?? null,
    metadata: params.metadata ?? {}
  })
}


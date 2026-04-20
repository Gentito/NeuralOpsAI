export type LinkedEntityType = "request" | "project" | "task"

export type AutomationJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled"

export type AutomationJob = {
  id: string
  org_id: string
  entity_type: LinkedEntityType | null
  entity_id: string | null
  job_type: string
  payload: any
}


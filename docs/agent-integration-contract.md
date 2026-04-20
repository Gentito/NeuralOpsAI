# Agent Integration Contract (Production App)

This platform treats AI agents as first-class system actors. The production app (Next.js on Vercel) + Supabase is the source of truth. Trae agents (or any external agent runner) integrate by calling these endpoints; they do not directly own application state.

## Authentication

Agents authenticate using a system actor token.

- Header: `Authorization: Bearer <token>`
- Token is generated once by an internal admin endpoint and stored hashed in Supabase.

## Endpoints

### Work queue

`GET /api/agent/queue`

Returns tasks assigned to this system actor (via `system_actor_assignments`).

### Post internal comment

`POST /api/agent/tasks/:id/comment`

Body:
```json
{ "body": "..." }
```

### Update status (reversible)

`POST /api/agent/tasks/:id/status`

Body:
```json
{ "status": "in_progress", "reason": "optional" }
```

Writes a `task_status_history` record and an `agent_action_logs` record.

### Revert status (reversible)

`POST /api/agent/tasks/:id/revert-status`

Body:
```json
{ "toHistoryId": "optional-history-uuid" }
```

### Create deliverable (text-based)

`POST /api/agent/tasks/:id/deliverable`

Body:
```json
{ "title": "Result", "body": "content...", "mimeType": "text/markdown", "visibility": "internal" }
```

### Create subtask

`POST /api/agent/tasks/:id/subtasks`

Body:
```json
{ "title": "Follow-up", "description": "optional" }
```

### Complete task

`POST /api/agent/tasks/:id/complete`

Body:
```json
{ "summary": "optional", "createClientUpdateDraft": false }
```

Releases the assignment and records status history + action log.

## Admin: create a system actor token

`POST /api/admin/system-actors`

Body:
```json
{ "name": "Trae Worker 01", "kind": "trae_agent", "label": "primary" }
```

Returns the plaintext token once.


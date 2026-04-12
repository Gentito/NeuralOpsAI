---
name: "skill_app_builder"
description: "Generates scalable app structure (frontend+backend), APIs, and integration steps. Invoke when building a new app/MVP or adding major features."
---

# skill_app_builder

## Purpose

Standardize how NeuralOps AI turns requirements into a working full-stack app layout with clear boundaries, integration points, and run instructions.

## When to Invoke

- User asks to build a new product/MVP from scratch
- User asks to add a major feature spanning frontend + backend + database
- You need to refactor an app into a scalable structure (modules, layers, contracts)

## Inputs to Collect (if available)

- Target stack (frontend, backend, DB, auth, hosting)
- Core entities (e.g., Client, Project, Task, Invoice)
- Key user roles and permissions
- Must-have flows and acceptance criteria
- Constraints (time, integrations, compliance)

## Output Contract

1. Architecture summary (modules, data flow, boundaries)
2. File/folder structure
3. Backend API spec (endpoints + schemas)
4. Database schema (tables + indexes)
5. Frontend screens and components mapped to endpoints
6. Local run instructions + env vars
7. Minimal tests to validate integration

## Execution Checklist

- Keep contracts stable: define request/response shapes before coding
- Prefer simple primitives first (REST + JWT) before adding complexity
- Add seed data or mocks so UI can be developed immediately
- Ensure no secrets are committed; include `.env.example`


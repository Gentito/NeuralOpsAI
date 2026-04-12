---
name: "skill_reporting"
description: "Summarizes operations into KPIs, risks, and next actions. Invoke when user asks for a status report, weekly update, or performance dashboard."
---

# skill_reporting

## Purpose

Produce concise operational reporting for NeuralOps AI: what’s happening, what’s blocked, and what to do next.

## When to Invoke

- Weekly/daily status updates
- Executive summaries after a build cycle
- Dashboards that need KPIs and risk highlights

## Output Contract

- Current status (projects, tasks, agents workload)
- KPIs (throughput, cycle time, SLA, revenue if applicable)
- Risks / blockers (with owners and mitigation)
- Recommendations (next actions, priorities)

## KPI Suggestions

- Tasks: created vs completed, WIP, aging tasks
- Projects: active vs paused, milestone progress
- Support: tickets by category, first response time, resolution time
- Finance: invoices issued/paid/outstanding (no payments without approval)


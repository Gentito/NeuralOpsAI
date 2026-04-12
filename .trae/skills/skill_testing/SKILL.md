---
name: "skill_testing"
description: "Creates test plans, edge cases, and automation scaffolds. Invoke when shipping features, fixing bugs, or validating APIs/flows."
---

# skill_testing

## Purpose

Ensure new features and bug fixes are verifiable with repeatable checks (manual + automated) and clear pass/fail criteria.

## When to Invoke

- Before declaring a feature “done”
- When a bug is reported and needs a regression test
- When adding or changing API endpoints, auth, or data validation

## Output Contract

- Test plan (scope, risks, environments)
- Test cases (happy path + edge cases + negative cases)
- Automation suggestions (unit/integration/e2e) mapped to the codebase
- Pass/fail report template

## Coverage Guidelines

- Validate input schema and error handling (400/401/403/404/409/422)
- Confirm idempotency where expected (PUT/PATCH)
- Include pagination/filtering tests if relevant
- Include security checks for auth and sensitive data exposure


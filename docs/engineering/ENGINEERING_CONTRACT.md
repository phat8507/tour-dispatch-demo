# Engineering Contract

## Purpose

Production V1 evolves this deterministic dispatch demo into a small, auditable system for anh Ngoc. It proposes two or three assignments; only the OWNER confirms or overrides them. Employees have no accounts or GPS, maps are projections, and tours never auto-swap.

## Boundaries and ownership

`app/routes -> application commands and queries -> domain <- infrastructure adapters`.

- `src/domain` owns pure scheduling policies, eligibility, ranking, and ports; it imports no React, Next.js, database, Supabase, or map SDK.
- Application commands own authorization, validation, transactions, idempotency, and canonical responses.
- Infrastructure owns persistence, sessions, and provider implementations. `TravelTimeProvider` is an explicit adapter boundary.
- Client components render view models and submit intent; server code performs decisions and writes. The database is the future source of truth, not client state or map data.

## Reliability and operations

- Commands validate input, return actionable expected errors, and surface unexpected failures without leaking sensitive details.
- Confirm and override operations run in transactions, re-check eligibility, protect against stale/repeated requests, and preserve an idempotency outcome where applicable.
- The database must reject overlapping active assignments even if an application check is bypassed. Concurrent requests must fail safely, never silently reassign.
- Record actor, time, reason, before/after state, and correlation/request identifier for assignment mutations. Emit structured failures and operational signals sufficient to diagnose command errors and conflict rates.
- Authorize every server command; hiding UI is not authorization. Minimize data exposure and secrets. Future RLS/auth work requires server-side authorization and tests.

## Constraints and delivery

No BaseRepository/BaseService, service locator, DI container, microservices, complex CQRS, event sourcing, or global event bus. Add only named boundaries with a current use case.

Done means scoped code and behavior tests pass the quality gate, the PR explains risk and rollback, and a reviewer can verify source-of-truth, authorization, transaction, and audit effects. Roll back by reverting the isolated deployable change; schema changes require an approved reversible migration/backup plan. Human approval is required for business-rule changes, credentials, database/vendor decisions, deployment, and any automatic reassignment behavior.

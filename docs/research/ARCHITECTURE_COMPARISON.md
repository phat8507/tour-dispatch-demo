# Architecture Comparison

## Decision

Adopt a **modular monolith**: one Next.js application, one deployment, and one relational database. Keep the domain independent of React, Next.js, Supabase, Maps, and HTTP. Do not introduce microservices, a monorepo, CQRS/event sourcing, global event bus, BaseRepository/BaseService, or a DI container/service locator.

| Option | Fit | Decision |
|---|---|---|
| Current browser-memory demo | Fast deterministic demo; no persistence or concurrency protection | Reject for production. |
| Modular Next.js monolith | Small V1 surface, coherent transaction, simple operation and deployment | Select. |
| Microservices/event-driven CQRS | Adds distributed consistency and operational burden before a second bounded context exists | Reject. |
| Monorepo/multi-app | No current shared-package or deployment need | Reject. |

## Boundary comparison

| Concern | Current | Production V1 |
|---|---|---|
| Source of truth | React `useState` plus `RuntimeOverride` map | Database transaction; server command returns new view model. |
| Eligibility | Pure engine invoked from browser | Same pure engine invoked by server application layer. Client displays result only. |
| Assignment confirmation | Client updates arrays | Owner-authenticated server command, transaction, database overlap constraint, audit event/row. |
| Map | Deterministic UI projection and client interactions | Projection/view only; never source of truth. GPS remains out of scope. |
| Travel time | Engine imports mock provider | Port injected by composition: Haversine deterministic adapter now; Google Routes adapter only when enabled. |
| Authentication | None | One OWNER account/session; staff do not log in; no multi-role framework. |

## Required data integrity

The assignment table must model employee, order, start/end, status, version/audit fields, and reject invalid intervals. It must prevent overlapping active/confirmed assignments for the same employee at the database layer (for PostgreSQL, an exclusion constraint over employee and a half-open time range is a suitable implementation). The application command must still re-run eligibility inside its transaction because a database constraint alone cannot produce an operator-friendly alternative list.

`Effective Assignment` should cease being a client overlay. An override is an explicit server command that validates the requested transition, updates the canonical assignment, records actor/time/reason, and returns re-computed state. No automatic tour swaps are allowed.

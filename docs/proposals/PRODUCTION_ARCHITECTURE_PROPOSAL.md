# Production V1 Architecture Proposal

## Outcome

Production V1 serves only anh Ngọc through one OWNER account. Employees do not authenticate. The system proposes two or three choices; anh Ngọc confirms or explicitly overrides an assignment. It never auto-swaps tours, receives no direct GPS, and treats maps as presentation only.

## Modules and dependency direction

```text
Next App Router (server pages/actions, small client islands)
  -> application/dispatch (commands, queries, authorization)
    -> domain/dispatch (entities, policies, Assignment Engine, ports)
    <- infrastructure (database repositories, session, travel adapters)
  -> presentation (map/timeline view models)
```

Suggested folders within the one application:

```text
src/
  app/                         # routes, server composition, server actions
  features/dispatch/           # UI and view models only
  application/dispatch/        # suggest/confirm/override commands and queries
  domain/dispatch/             # pure policies, types, TravelTimeProvider port
  infrastructure/              # db, auth/session, Haversine/Google adapters
  data/seed/                   # deterministic development/demo fixtures only
```

No domain file imports React, Next.js, a database SDK, Supabase, or a map SDK. No client component imports server infrastructure. Avoid abstract base services/repositories; use small named interfaces at real boundaries such as `AssignmentStore` and `TravelTimeProvider`.

## Main commands

1. `suggestAssignment(orderDraft)`: server authenticates OWNER, validates input, loads canonical schedule, calls the pure engine, and returns 2–3 ranked alternatives or a clear no-eligible result.
2. `confirmAssignment(orderId, employeeId, expectedVersion)`: server authenticates OWNER, loads current state in a transaction, recalculates eligibility, inserts/updates the assignment, relies on database overlap protection, writes audit data, and returns canonical state. A stale choice is rejected, never silently reassigned.
3. `overrideAssignment(assignmentId, requested change, reason)`: server authenticates OWNER, validates transition and overlap in a transaction, persists it and audit data. Override remains a human choice, not an automatic swap.

## Travel provider

Keep the port pure:

```text
TravelTimeProvider.estimate(origin, destination) -> { distanceKm, travelMinutes }
```

Use a deterministic Haversine adapter for tests/demo and a Google Routes adapter only in server infrastructure when future product authority permits it. The engine receives the provider through an explicit command dependency. Cache/rate-limit adapter use outside the domain. Map coordinates and route estimates are inputs, never assignment authority.

## Security and operations

One cookie-backed OWNER session is sufficient. Validate authorization in every server command; hiding controls in the browser is not authorization. Validate all command payloads at the server boundary. Store audit fields for create/confirm/override and make failures observable. This proposal intentionally excludes staff accounts, complex RBAC, GPS ingestion, automated reassignment, microservices, and external integrations beyond the permitted future travel adapter.

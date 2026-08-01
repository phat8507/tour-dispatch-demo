# Engineering Contract

## Product boundaries

- This repository is the deterministic tour-dispatch demo and its Production V1 preparation.
- Production V1 serves only anh Ngoc through one OWNER account. Employees have neither accounts nor GPS.
- The system proposes 2–3 options; anh Ngoc confirms an assignment or explicitly overrides it. It never auto-swaps tours.
- Client and map are projections, never sources of truth. A future database must prevent active assignment overlap.

## Architecture

- Keep business logic outside React components. Domain code must not import React, Next.js, Supabase, or Google Maps.
- Keep UI in `src/components`, domain logic in `src/domain`, mock data in `src/data`, shared types in `src/types`, and tests in `tests` or next to domain code.
- Do not add abstractions without a use case. Do not use BaseRepository, BaseService, service locators, DI containers, microservices, complex CQRS, event sourcing, or a global event bus.
- `TravelTimeProvider` is an allowed explicit adapter boundary.

## Scoped delivery and test discipline

- Follow the requested task scope; do not expand it or edit unrelated files. Do not invent business rules. Do not modify `docs/BUSINESS_RULES.md` unless explicitly requested.
- Never delete, skip, weaken, focus (`test.only`), or hide tests; do not raise timeouts arbitrarily. Keep tests deterministic.
- Do not suppress problems with `eslint-disable`, `@ts-ignore`, or `any`; preserve TypeScript strictness.
- Do not add Google Maps, Supabase, external APIs, or dependencies unless the task explicitly authorizes them.
- For scheduling logic, add behavior-focused tests. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` before completion.
- Do not commit or push unless explicitly authorized. Report changed files, validation results, test count, and failures honestly.

## Ambiguity and nested instructions

- Stop and request clarification when requirements conflict or necessary business information is missing.
- A future nested `AGENTS.md` may narrow these rules for its directory, but may not weaken this root contract.

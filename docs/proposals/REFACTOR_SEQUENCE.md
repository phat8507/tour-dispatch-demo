# Refactor Sequence

All tasks preserve the locked V1 rules and are intentionally small. “Codex” implements scoped code/tests; “Antigravity” can review UX/acceptance flows; “human” approves business rules, credentials, and deployment decisions.

## 1. Freeze current scheduling contract

- Goal: characterize existing engine/confirmation behavior as named fixtures.
- Why: migrate architecture without inventing business rules.
- Expected files: `tests/assignment-engine.test.ts`, `tests/order-flow.test.ts`, new focused test fixtures only.
- Preserve: R1–R4, score/ranking, maximum three options, no auto-assignment.
- Tests: add boundary fixtures only where audit identified Production gaps; retain 140 baseline tests.
- Acceptance: behavior snapshot/fixtures pass and no production source behavior changes.
- Risk / rollback: accidental rule reinterpretation; revert this isolated test diff.
- Diff size: small, under 250 lines.
- Responsibility: Codex implementation; Antigravity reviews operator wording; human resolves ambiguous policy.

## 2. Extract pure dispatch domain modules

- Goal: split candidate lookup, scoring, time handling, and confirmation policy from oversized modules.
- Why: make the engine portable to server commands and independently testable.
- Expected files: `src/domain/assignment-engine.ts`, `src/domain/order-flow.ts`, new `src/domain/dispatch/*`, related tests.
- Preserve: existing public behavior and deterministic IDs during transition.
- Tests: exact regression suite plus unit tests for extracted modules.
- Acceptance: no domain import of React/Next/database/maps; lint/typecheck/tests pass.
- Risk / rollback: changed time-zone or overlap semantics; revert module extraction commit.
- Diff size: medium, 400–800 lines moved/changed.
- Responsibility: Codex implementation; Antigravity no ownership; human approves any policy change.

## 3. Introduce explicit ports and remove mock coupling

- Goal: pass `TravelTimeProvider` into application/domain composition and move fixtures to seed/demo composition.
- Why: engine currently imports `mockTravelTimeProvider` directly.
- Expected files: domain port/engine, Haversine adapter, seed data composition, tests.
- Preserve: deterministic Haversine outputs and demo behavior.
- Tests: provider contract, invalid-coordinate and timeout/error mapping tests.
- Acceptance: no domain import from `src/data/mockData`; no Google integration required.
- Risk /rollback: result ranking drift; retain/restore deterministic adapter wiring.
- Diff size: small-medium, under 500 lines.
- Responsibility: Codex implementation; human authorizes any future Google Routes credentials; Antigravity reviews UI explanations.

## 4. Add durable schema and overlap invariant

- Goal: create canonical persisted orders, assignments, employees, locations, and audit records with active-assignment overlap prevention.
- Why: client state cannot handle refreshes or concurrency.
- Expected files: future database schema/migrations, `src/infrastructure/db/*`, integration tests.
- Preserve: half-open interval behavior, manual confirmation/override, no automatic swap.
- Tests: transaction race/concurrent confirm, overlap rejection, canceled assignment behavior, audit write.
- Acceptance: database rejects same-employee active overlap even if application checks are bypassed.
- Risk /rollback: migration/data issue; deploy reversible migration/backup plan approved by human.
- Diff size: medium-large, 600–1,200 lines.
- Responsibility: Codex scaffolding/tests; human chooses database/vendor and approves migration; Antigravity no ownership.

## 5. Add single-owner server boundary

- Goal: replace browser confirmation/override mutations with owner-authenticated server commands.
- Why: eligibility and writes must be server authoritative.
- Expected files: `src/app/*`, `src/application/dispatch/*`, session/auth infrastructure, feature UI, tests.
- Preserve: one OWNER only; staff no login; client displays alternatives but decides none.
- Tests: unauthenticated/unauthorized command rejection, stale version, confirm/override happy paths.
- Acceptance: client cannot choose eligibility or persist an assignment without server command.
- Risk /rollback: session outage; retain read-only operator view and revert server action deployment.
- Diff size: medium-large, 700–1,400 lines.
- Responsibility: Codex implementation; human supplies owner identity/session policy; Antigravity validates UX.

## 6. Replace effective overlay and thin the dashboard

- Goal: make override canonical and split `DashboardPage` into server data loader plus client islands.
- Why: eliminate transient `RuntimeOverride` state and a 275-line client controller.
- Expected files: `src/app/page.tsx`, `src/features/dispatch/*`, application commands/view models, delete/retire overlay only after replacement.
- Preserve: map/list/timeline views, reset only in demo environment, explicit human override.
- Tests: UI confirms route refresh shows canonical state; map stays projection; no timeline regression.
- Acceptance: no `RuntimeOverride` map as operational source of truth; client UI contains no scheduling mutation rules.
- Risk /rollback: UI flow regression; feature-flag/read-only fallback and revert deploy.
- Diff size: medium, 500–1,000 lines.
- Responsibility: Codex implementation; Antigravity acceptance review; human signs off workflow.

## 7. Production validation and guardrails

- Goal: make validation repeatable and detect lost tests/unsafe TypeScript.
- Why: historical UI regression illustrates that test counts alone are insufficient.
- Expected files: test config/scripts, lint config, repository instructions, coverage configuration if approved.
- Preserve: deterministic tests and existing commands.
- Tests: discovery assertion/coverage report, fake-timer test for live-clock UI, production build.
- Acceptance: lint, typecheck, unit/integration tests, build, and explicit coverage/discovery checks pass in CI.
- Risk /rollback: noisy rules block delivery; enable rules in stages and revert only the new rule configuration.
- Diff size: small-medium, under 400 lines.
- Responsibility: Codex configuration/tests; human approves CI and required thresholds; Antigravity no ownership.

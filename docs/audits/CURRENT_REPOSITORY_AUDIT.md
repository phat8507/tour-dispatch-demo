# Current Repository Audit

## Scope and baseline

Read-only audit of `demo-v1-baseline` (`bbd8709`, current `audit/production-readiness`). `src/`, `tests/`, manifests, and configuration were not changed.

Baseline environment: Node `v24.14.1`, npm `11.11.0`. `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` all passed. Vitest reported **7 test files, 140 passed, 0 failed, 0 skipped**. Build completed successfully with static routes `/` and `/_not-found`.

The 7 discovered files are `assignment-engine.test.ts`, `demo.test.ts`, `domain.test.ts`, `map-domain.test.ts`, `order-flow.test.ts`, `order-flow-ui.test.tsx`, and `time-input.test.ts`.

## Regression analysis

| Commit | Test files present | Declared cases | Evidence-backed result |
|---|---:|---:|---|
| `5081c0f` | 6 | 129 direct declarations; parameterized expansion accounts for 132 | Adds `time-input.test.ts` (9 cases) and updates the UI test. |
| `5f53808` | 7 | 137 direct declarations; parameterized expansion accounts for 140 | Adds `map-domain.test.ts` (8 cases); does not delete a test file or alter Vitest discovery. |
| `bbd8709` | 7 | unchanged from `5f53808` | Adds no test declaration; fixes three existing UI cases by opening the newly hidden Timeline before assertions. |

`132` is the pre-map suite total: 129 direct `it` declarations plus the expansion of parameterized tests. `140` is `132 + 8` map-domain cases. The repository history contains no test-run output, config change, or code literal that establishes an origin for `102`; it therefore cannot be attributed to any of these three commits without speculation. The test files at `5f53808` and `bbd8709` are identical except for the three Timeline-navigation edits in `tests/order-flow-ui.test.tsx`.

The three affected cases are: explicit confirmation/addition (around line 174), confirmed detail/summary (around line 218), and reset (around line 328). In `5f53808`, `src/app/page.tsx:41` defaults `activeTab` to `"MAP"` and conditionally renders `DailyTimeline` only for `"TIMELINE"` (around lines 211–224); the prior tests queried timeline blocks without selecting that tab. `bbd8709` adds `openTimeline()` and calls it in exactly these cases. This is a behavioral test failure, not a discovery failure.

## Findings

### Critical

1. Client memory is the mutable source of truth. `src/app/page.tsx:37–48` owns dispatch state, tab selection, selected objects, recommendations, messages, and reset; `src/hooks/useDispatchDashboard.ts:7–9` owns current time and runtime overrides. A refresh, second browser, or concurrent confirmation loses or races that state. Production assignment confirmation must be server-authoritative and transactional.

2. `src/domain/effective-assignment.ts:11–24` overlays in-memory `RuntimeOverride` data only. `src/app/page.tsx:75–82` uses that overlay for confirmation revalidation but writes `result.state` without persisting overrides. Thus an override can influence eligibility transiently, then disappear. The database needs authoritative assignment state and an overlap constraint; map projections must consume it, never define it.

### High

1. `src/app/page.tsx` is 275 lines (>200) and is a client component for the entire dashboard (`"use client"`, line 1). It imports mock data, creates business state, revalidates confirmation, derives summaries, and controls three views. Split server data loading / server actions from a thin client interaction shell.

2. `src/domain/assignment-engine.ts` is 456 lines and `src/domain/order-flow.ts` is 404 lines (>300). `suggestAssignments` (lines 322–456, ~135 lines) and `confirmOrderAssignment` (320–404, ~85 lines) exceed 60 lines. They combine policies, lookup, date handling, ranking, command orchestration, and IDs. Preserve their pure behavior but divide them into policy, time, candidate, and command modules.

3. Production and mock concerns are coupled: `src/domain/assignment-engine.ts:17` directly imports `mockTravelTimeProvider`; `src/data/mockData.ts` creates domain-shaped data and deterministic IDs; `src/app/page.tsx:4–10` imports it directly. Inject a `TravelTimeProvider` and place seed fixtures outside production composition.

4. UI contains operational mutations: `src/components/map/EmployeeStatusPanel.tsx:137–155` constructs status/start/end overrides and calls `addMinutesPreservingOffset`; `src/app/page.tsx:66–74` derives map recommendation display state. The UI should submit intentions; application/server commands decide the valid state transition.

5. There is no persistence, authentication, audit trail, optimistic concurrency, or database overlap protection. These are required for the locked one-owner Production V1, even though multi-role workflow is explicitly out of scope.

## Other audit checks

| Check | Result and method |
|---|---|
| Assignment Engine / Effective Assignment | Found: engine at `src/domain/assignment-engine.ts:322`; effective overlay at `src/domain/effective-assignment.ts:11`. The engine is pure except for direct mock provider import; overlay is transient. |
| Files >300 lines | Found: `assignment-engine.ts` (456), `order-flow.ts` (404), `tests/assignment-engine.test.ts` (1101), `tests/order-flow-ui.test.tsx` (400), `tests/order-flow.test.ts` (394). |
| Components >200 lines | Found: `DashboardPage` 275 (`src/app/page.tsx`), `OrderFlowDialog` 257, `CreateOrderForm` 224, `DailyTimeline` 213. |
| Functions >60 lines | Found: `scoreCandidate` (~90), `suggestAssignments` (~135), `isValidExplicitTimestamp` (~47 plus long validation), `confirmOrderAssignment` (~85); `OrderFlowDialog` render function is ~200. Line/brace inspection of all `src/**/*.ts(x)` used. |
| Duplicate logic/types | Found: timestamp-offset parsing in engine (`192–218`) and order flow (`299–317`); status colors in `DailyTimeline.tsx:19` and `AssignmentDetailSheet.tsx:31`; map/list/timeline derive assignment views independently. Shared types are centralized in `src/types/index.ts` (keep that direction). |
| `any`, ts-ignore, ts-expect-error, eslint-disable, TODO/FIXME/HACK, console.log/debug | **Không tìm thấy** in `src/` or `tests/`; checked with `rg` patterns for each token. |
| Non-null assertion | Found six uses of `status.activeAssignment!` at `EmployeeStatusPanel.tsx:137–155`; render condition appears to guard it, but narrow to a local value instead. |
| Import cycles | **Không tìm thấy** by inspecting the local import graph (`rg` of imports in `src`); no back-edge from domain to component/hook/app. Re-check with a cycle rule/tool when architecture changes. |
| Unused dependencies | Likely unused runtime packages `date-fns`, `lucide-react`, `shadcn`, `tw-animate-css` (no imports found by `rg` in tracked source); `@base-ui/react` is used through copied UI components. This is an audit finding only; no manifest changes made. |
| Catch-all utilities | `src/lib/utils.ts` is the small shadcn `cn` helper, not a catch-all. **Không tìm thấy** generic BaseRepository/BaseService/service-locator utilities. |
| Real time/random tests | No `Date.now` or `Math.random` in `src/tests`. `useDispatchDashboard.ts:16,24` passes `new Date()` only in explicit LIVE mode; domain helpers accept explicit time. Test uses `vi.setSystemTime` at `assignment-engine.test.ts:481–483` and an explicit Date in map tests. No real-time-dependent test found. |
| Business rules missing tests | R1–R4, cap 3, ranking, warnings, overlap, cancellation, travel boundaries, deterministic ordering, and confirmation revalidation have coverage. Missing Production V1 tests: owner-only server command, durable override/audit record, concurrent confirmations, database exclusion/overlap rejection, travel-provider failure/timeout, and server-side validation independent of client. |

## Keep vs refactor

Keep: strict TypeScript, pure domain-oriented functions, explicit inputs, deterministic mock data, `TravelTimeProvider` interface, Haversine calculations, half-open interval handling, revalidation before confirmation, and broad scheduling regression tests.

Refactor before production: client-owned dispatch/effective-assignment state; direct mock-provider import; page-level orchestration; duplicate time/formatting policy; map component operational commands; and the two oversized domain modules. Do not change locked scoring or eligibility policy without a business decision.

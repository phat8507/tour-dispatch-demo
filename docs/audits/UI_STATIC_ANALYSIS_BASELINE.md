# UI Static Analysis Baseline

Status: Static analysis only

Browser verification: Not performed

Responsive verification: Not performed

Console verification: Not performed

Network verification: Not performed

Accessibility interaction verification: Not performed

## Scope and evidence

This document records conclusions derived only from source inspection of the
current baseline. It does not report browser observations, interaction results,
or runtime network/console results.

## Confirmed architecture and UI composition

- **Confirmed by source inspection:** `src/app/page.tsx:37–48` uses React
  client state for dispatch state, active tab, selection, recommendations,
  messages, and dialog-related state. `src/hooks/useDispatchDashboard.ts:7–9`
  keeps time mode, current time, and runtime overrides in client state.
- **Confirmed by source inspection:** `src/app/page.tsx:41` initializes the
  default tab as `MAP`; the Map, List, and Timeline bodies are conditionally
  rendered at lines 170–225.
- **Confirmed by source inspection:** `src/domain/assignment-engine.ts:456`
  returns no more than three suggestions through `slice(0, 3)`.
- **Confirmed by source inspection:** `src/components/order-flow/OrderFlowDialog.tsx`
  contains `confirmingRef` to prevent overlapping confirmation work within one
  client instance. This does not establish behavior across clients or requests.
- **Confirmed by source inspection:** `src/app/page.tsx:75–119` and
  `src/components/map/EmployeeStatusPanel.tsx:137–155` coordinate operational
  mutations from UI callbacks and client state.
- **Confirmed by source inspection:** no production API/database boundary is
  present in `src/`; the page imports `src/data/mockData.ts` and creates its
  initial dispatch state in the browser.

## Persistence and reload risk

- **Confirmed by source inspection:** Source inspection indicates that runtime
  changes are not durably persisted and are expected to be lost when the page
  state is recreated. This was not verified in a browser.
- **Not verified in browser:** an actual reload, navigation, or recovery flow.

## Structural responsive risks

- **Confirmed by source inspection:** `src/components/DailyTimeline.tsx` has a
  900px minimum-width timeline structure and a fixed-width employee column.
  This is a structural risk for narrow viewports, not a reproduced responsive
  defect.
- **Confirmed by source inspection:** `src/app/page.tsx` renders navigation and
  dashboard regions through nested flex layouts with fixed padding; source
  inspection alone cannot establish clipping, overflow, tap target quality, or
  text truncation.
- **Not verified in browser:** layout at desktop, laptop, tablet, or mobile
  viewports.

## Finding classification

- **Production blocker — Confirmed by source inspection:** browser-memory
  dispatch state and runtime overrides are not a durable, concurrent,
  server-authoritative assignment source of truth.
- **High architectural risk — Confirmed by source inspection:** UI components
  directly orchestrate mutation intent while no production API/database
  transaction boundary exists.
- **Medium maintainability risk — Confirmed by source inspection:**
  `src/app/page.tsx` combines state ownership, orchestration, and rendering;
  `OrderFlowDialog` combines form and confirmation flow state.
- **Browser verification required — Not verified in browser:** any claim about
  visual regression, responsive defect, successful interaction flow, console,
  network, keyboard behavior, focus behavior, or duplicate creation caused by
  repeated user input.

## Future browser verification checklist

- **Not verified in browser:** default tab on first render.
- **Not verified in browser:** Map/List/Timeline navigation.
- **Not verified in browser:** create-order required-field validation.
- **Not verified in browser:** requested-time entry, validation, and quick
  actions.
- **Not verified in browser:** urgent state presentation and effect on the
  visible flow.
- **Not verified in browser:** suggestion count and displayed ranking.
- **Not verified in browser:** confirmation and resulting rendered assignment.
- **Not verified in browser:** repeated confirmation/double-click behavior.
- **Not verified in browser:** status-change controls and rendered updates.
- **Not verified in browser:** reset behavior.
- **Not verified in browser:** reload and durability behavior.
- **Not verified in browser:** four target viewports: 1440x900, 1280x720,
  768x1024, and 390x844.
- **Not verified in browser:** Console output and Network requests.
- **Not verified in browser:** keyboard navigation, focus order, and focus
  restoration.

## Behavior to preserve during refactoring

- **Confirmed by source inspection:** assignment suggestions are capped at
  three and require explicit confirmation before a new assignment is added.
- **Confirmed by source inspection:** the UI offers Map, List, and Timeline
  views, with Map selected by initial client state.
- **Confirmed by source inspection:** the existing single-client confirmation
  guard is a useful UX protection, but server/database idempotency and overlap
  protection are required for production correctness.

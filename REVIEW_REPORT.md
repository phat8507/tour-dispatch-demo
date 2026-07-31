# Assignment Engine Adversarial Review

## Defects Found

1. Invalid assignment intervals could produce false-positive overlaps when the
   end time preceded the start time but still fell inside the proposed
   interval. Invalid intervals also incorrectly contributed to workload
   scoring.
2. Assignments belonging to cancelled orders still blocked proposed work and
   could be selected as the employee's current travel origin.
3. Invalid or non-finite coordinates produced `NaN` travel values and could
   cause `RangeError: Invalid time value` instead of safely excluding the
   candidate. Finite coordinates outside valid latitude/longitude bounds were
   also accepted by the travel provider.
4. An explicitly supplied empty `serviceIds` array silently fell back to the
   legacy singular `serviceId`, turning an invalid no-service request into a
   valid suggestion.
5. Assignments belonging to off employees were included in the numerator of
   the workload average even though off employees were excluded from its
   denominator.
6. Workload-day matching compared the first ten timestamp characters instead
   of comparing calendar dates in the requested timestamp's offset. Equivalent
   instants written with different offsets could be assigned to the wrong day.
7. Duplicate employee records produced duplicate suggestions and could fill
   all three result slots with the same employee ID.

## Failing Tests Added

The pre-fix focused runs demonstrated ten failing regression cases across the
seven root defects:

- reversed assignment interval falsely overlapping;
- invalid assignment intervals affecting workload;
- cancelled order assignment blocking availability;
- cancelled current order assignment changing travel origin;
- non-finite coordinates throwing during suggestion generation;
- finite out-of-range coordinates being accepted by the travel provider;
- explicit empty service list falling back to the singular service;
- off-employee assignments distorting workload average;
- equivalent local-day timestamps with different offsets being ignored;
- duplicate employee inputs producing duplicate suggestions.

Additional adversarial tests were added for:

- half-open interval adjacency, partial overlap, containment, and midnight
  spanning;
- future-only and completed assignments;
- Haversine known-distance and zero-distance cases;
- preparation buffer and upward rounding;
- exact and late arrival boundaries;
- exact and over-limit NEW_TOUR distance;
- duplicate, unknown, and multi-service handling;
- scoring explanations, negative scores, and workload date isolation;
- deterministic ranking, repeated calls, and reversed input order;
- legacy EXPERT/STRONG and MILEAGE/REFILL behavior compatibility.

## Fixes Made

- Added reusable interval validation and applied it to current assignments,
  completed-assignment origins, overlap checks, working hours, and workload
  inputs.
- Filtered assignments whose referenced order is cancelled before
  availability, origin, overlap, and workload calculations.
- Added finite coordinate and geographic-bound validation. Invalid estimates
  now return non-finite sentinel values that the engine safely rejects.
- Clamped the Haversine intermediate value to its mathematically valid range to
  avoid floating-point domain errors.
- Made an explicitly present `serviceIds` array authoritative; an empty array
  now yields no suggestions. The singular `serviceId` remains the fallback only
  when `serviceIds` is absent.
- Restricted workload assignments to unique, non-off employees and compared
  dates in the requested timestamp's explicit offset.
- Collapsed employee inputs by ID before eligibility, workload, and ranking so
  each employee can produce at most one suggestion.

## Assumptions Retained

- `SCHEDULED`, `IN_PROGRESS`, and `DELAYED` are the confirmed assignment
  statuses because the current assignment schema has no separate confirmation
  field.
- Half-open intervals use `start <= time < end`; adjacent assignments do not
  overlap.
- `EXPERT` remains behavior-compatible with `STRONG`, and `MILEAGE` remains
  behavior-compatible with `REFILL`. The legacy values are retained because
  existing mock data uses them; scoring and eligibility normalize them to one
  behavior rather than applying duplicate rules.
- When `serviceIds` is absent, the existing singular `serviceId` is the required
  service.
- Completed assignments count toward daily workload but do not block
  availability.

## Remaining Limitations

- `AssignmentStatus` has no `CANCELLED` value. Cancellation filtering therefore
  works through the referenced order's `CANCELLED` status.
- The engine expects valid explicit ISO timestamps for top-level order,
  employee, and current-time fields and valid non-negative service durations;
  this review did not add a general input-validation layer.
- Missing referenced orders or locations can make an employee ineligible
  because a deterministic travel origin cannot be resolved.
- Conflicting duplicate employee records are collapsed by ID but are not
  reported as a data-quality error.
- Travel remains the specified deterministic straight-line demo estimate, not
  road routing.
- Per the stated origin rules, the engine does not route through a future
  non-overlapping assignment before the proposed order.

## Exact Verification Results

Run on branch `fix/assignment-edge-cases`:

- `npm run lint`: passed, exit code 0, zero errors and zero warnings.
- `npm run typecheck`: passed, exit code 0, zero errors and zero warnings.
- `npm run test`: passed, 2 test files and 64 tests passed.
- `npm run build`: passed, exit code 0; Next.js production compilation,
  TypeScript validation, page-data collection, and static-page generation all
  completed successfully.

## UI Scope Confirmation

No React components, dashboard UI, app pages, documentation under `docs`, mock
data, database code, or API integration code was changed.

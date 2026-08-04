# Production candidate recommendations

- Recommendations are deterministic projections of persisted PostgreSQL state. They never assign or move a tour.
- Hard blocks are inactive employees, daily OFF, missing entities, unassignable orders, invalid intervals, stale versions, and database invariants.
- Complete technical-skill data is ranked as primary. When fewer than two primary candidates exist, missing-skill employees may be shown separately as `UNKNOWN_SKILL_FALLBACK` and require an explicit override reason.
- Missing skill rows remain `UNKNOWN`; no technical level is fabricated. Known `WEAK` remains valid complete data.
- Ranking order is availability, weakest required-service capability, total required-service capability, closing capability, lower workload, then employee ID.
- Workload counts non-cancelled assignments overlapping the tour's `Asia/Ho_Chi_Minh` business date. It is a ranking signal, not a hard limit.
- `NEAR_COMPLETION` means an `IN_PROGRESS` or `DELAYED` assignment has at most 30 minutes remaining according to persisted timestamps. It is explicitly an estimate, not GPS.
- Travel is provisional and is never converted into minutes, distance, or an arrival guarantee without an authoritative provider. Missing branch/customer coordinates are data-quality warnings.
- The owner page uses a constant number of bulk queries with respect to visible tour count. Read failures are surfaced safely and never become an empty/mock recommendation result.

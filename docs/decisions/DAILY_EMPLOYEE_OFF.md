# Daily employee OFF decision

- `employees.is_active` represents permanent operational participation. Daily leave is stored separately.
- An OFF record covers one full calendar date in `Asia/Ho_Chi_Minh`.
- OFF cannot be bypassed by normal confirmation, override, replacement, or direct active-assignment mutation.
- At most two distinct employees may be OFF on one business date.
- An active `SCHEDULED`, `IN_PROGRESS`, or `DELAYED` assignment overlapping the date blocks marking OFF.
- `COMPLETED` and `CANCELLED` assignments do not block OFF.
- The system never auto-cancels or auto-swaps assignments. The owner must resolve active assignments first.
- Employees do not authenticate; only the authenticated owner manages OFF dates.
- Missing `employee_service_skills` is recorded as UNKNOWN for the future recommendation task. Task A intentionally preserves the current confirm/override behavior.
- Working shifts, partial-day leave, recurring leave, recommendation scoring, pricing, debt, and revenue are outside this task and Production V1.

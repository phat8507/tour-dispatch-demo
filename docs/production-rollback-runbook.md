# Production rollback runbook

Current production SHA: `0de128b74064a6a905110798970a6a957590b4bb`. Current rollback reference: `6004c17`.

## Before every release

1. Record the Vercel Production deployment ID, deployment URL, and exact Git SHA in the release record.
2. Record the Neon production branch, database, and snapshot ID (or restore-history point) used for recovery.
3. Confirm the prior Vercel Production deployment remains available as a rollback candidate.

## Code rollback

Use Vercel **Instant Rollback** from the Production deployment view and select the previously verified deployment. Confirm its Git SHA, then verify it is Ready. Code rollback does not reverse a database migration.

## Database recovery without overwriting production

1. Create a Neon restore branch from the recorded snapshot or branch history; name it for the incident and timestamp.
2. Never restore over `production` before the restore branch has been inspected and approved.
3. On the restore branch, verify the migration ledger, required tables/functions, application read paths, and a non-destructive owner smoke test.
4. Record the comparison with production and obtain explicit approval before any finalize or swap operation.

## When code rolls back but schema has changed

Treat schema compatibility as a separate release gate. First confirm that the older code can operate safely with the current schema. If it cannot, rehearse recovery on the restore branch and choose an approved forward-fix or controlled database recovery. Do not drop production columns, tables, roles, or functions merely to match older code.

Migrations 007 and 008 have no automatic down-migrations because they add durable production schema and security boundaries; automatic reversal could destroy operational data or weaken grants. Recovery must be rehearsed on a Neon restore branch.

## Stop criteria and checklist

- [ ] Deployment ID and SHA recorded before release.
- [ ] Prior Vercel Production deployment remains available.
- [ ] Snapshot/history reference recorded.
- [ ] Restore branch verified without touching production.
- [ ] Rollback code is schema-compatible, or an approved recovery plan exists.
- [ ] No production overwrite, finalize, or destructive schema action occurs without verification and approval.

Stop immediately if the deployment SHA is ambiguous, a restore branch does not verify, the prior deployment is unavailable, schema compatibility is unknown, or any action would overwrite production before verification.

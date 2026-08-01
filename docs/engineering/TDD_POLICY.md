# TDD Policy

## Required coverage

Use RED → GREEN → REFACTOR for domain rules, assignment eligibility, availability, overlap/conflict prevention, scoring/ranking, order transitions, pricing, debt, touch-up logic, transaction behavior, idempotency, concurrency, authorization, RLS, and production bug fixes.

Each task records a new test or bug reproduction, evidence of RED, the minimum implementation for GREEN, the post-GREEN refactor, and the full quality-gate result. Tests must exercise behavior rather than implementation details when possible.

Test-first is not mandatory for copy, documentation, pure CSS, visual-only changes, or configuration with no logic. Those changes still run the full quality gate and require browser verification when they affect UI.

## Test integrity

Do not delete tests to pass, reduce assertions, replace specific assertions with weak ones, use snapshot-only tests for business rules, skip tests, leave unexplained `todo` tests, use `only`, raise arbitrary timeouts, rely on real time or uncontrolled randomness, or reduce the test count without explanation and approval.

## Current baseline

The baseline is **7 test files, 140 tests, 0 failed, 0 skipped**. It is not a ceiling: tests may increase. A decrease requires explanation and approval. This task does not set a coverage threshold.

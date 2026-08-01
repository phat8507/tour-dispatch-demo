# Quality Gates

## Current automated gate

Run locally, by agents, and in pull-request CI:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run quality` runs the same commands in that order. No formatter check is added because this repository has no configured formatter script.

CI uses Node 24 because the recorded repository baseline used Node v24.14.1 and the locked Next.js 16 toolchain was validated there. It runs for pull requests targeting `main` and pushes to `main`, with read-only repository permission.

## Gate layers

1. Local validation: authors run the four commands before handoff.
2. Agent validation: agents run and report the same commands plus scoped-diff checks.
3. Pull-request CI: GitHub Actions runs `npm ci` and `npm run quality`.
4. Human review: reviewer confirms scope, business rules, source-of-truth, and rollback implications.
5. Branch protection: after this workflow merges, configure required status checks and review requirements manually or through the GitHub API.

## Future gates

- Database phase: migration, transaction-race, overlap-constraint, backup/rollback, and integration tests.
- Authentication/RLS phase: authorization and RLS integration tests with server-side negative cases.
- Browser E2E phase: responsive, keyboard/focus, console, network, and critical dispatch-flow checks.

These future gates are not implemented by the current workflow.

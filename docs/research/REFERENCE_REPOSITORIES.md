# Reference Repository Research

Selective research only; no code, package, or template was copied.

## Useful patterns

| Repository | Evidence reviewed | Applicable lesson |
|---|---|---|
| `bulletproof-react` | root `AGENTS.md`, `apps/nextjs-app` | Organize by feature, colocate feature UI/hooks/types, retain shared app/components/config/lib layers, and keep a one-way dependency flow. Use this as a small feature-boundary convention, not its full stack. |
| `nextjs-reference` | root `AGENTS.md`, `examples/with-supabase/README.md` | App Router needs deliberate server/client boundaries and command-specific validation. Its Supabase example is a reference for browser/server client separation and cookie-backed sessions, not a template to copy. |
| `ssr` | `README.md`, `vitest.config.ts`, package metadata | A focused Vitest config explicitly excludes generated/dependency outputs. Keep test discovery explicit and small. |
| `codex` | root `AGENTS.md` | Repository-local instructions specify validation and scoped work. Production should retain a concise AGENTS.md with exact commands and ownership expectations, but this audit does not create one. |
| `vitest` | root `AGENTS.md`, test/config fixture structure | Discovery/config changes can alter coverage silently; use focused fixture-driven tests, deterministic clock injection/fake timers, and report coverage separately from test count. |
| `typescript-eslint` | root `eslint.config.mjs`, package layout | Type-aware rules can enforce `no-explicit-any`, non-null safety, unused dependencies/imports, and Vitest-specific test hygiene. Turn them on incrementally after code is ready. |

## Production V1 interpretation

Feature boundaries should be `dispatch`, `assignments`, and possibly `operations` rather than a global `components` layer holding application rules. Allowed dependency direction is:

`app/routes -> application commands/queries -> domain <- infrastructure adapters`

React client components may call server actions/route handlers and render returned view models. They must not determine eligibility, persist assignment changes, or merge effective assignments.

For an App Router deployment, pages and data access are server by default. Mark only interactive islands as client components. The server boundary validates the owner session, invokes the application command, serializes a view model, and revalidates its route. Never import database/server Supabase code into a client component.

If Supabase is selected later, use separate server and browser client factories, with the server factory reading/writing request cookies through the supported Next.js cookie bridge. Browser credentials remain browser-only; server authorization and scheduling decisions remain server-only. This is a future architecture decision, not an implementation request in this repository.

Vitest should retain conventional `*.test.ts(x)` discovery, add explicit `include` only if needed, and run coverage as a separate named command. Use explicit clock inputs for domain tests; use fake timers for polling/client clock behavior; fixtures should name scheduling cases (overlap, override, owner command) rather than hide them in monolithic setup.

Typed linting should eventually add, after code cleanup, `@typescript-eslint/no-explicit-any`, `no-non-null-assertion`, type-aware unsafe-operation rules, import cycle/unused dependency checks, and Vitest rules for disabled/focused tests. Do not claim these rules are currently configured: the current config is only Next core-web-vitals plus TypeScript presets.

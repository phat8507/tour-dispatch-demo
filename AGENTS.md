# Agent Instructions

## General

- Read all files in /docs before editing code.
- Do not invent business rules.
- Do not modify BUSINESS_RULES.md unless explicitly requested.
- Use TypeScript strict mode.
- Avoid any.
- Keep business logic outside React components.
- Add tests for all scheduling logic.
- Run lint, typecheck and tests before completing a task.
- Do not introduce Google Maps, Supabase or external APIs.
- Do not install a package unless necessary.
- Keep the demo deterministic.

## Architecture

- UI components belong in src/components.
- Domain logic belongs in src/domain.
- Mock data belongs in src/data.
- Shared types belong in src/types.
- Tests belong in tests or next to domain files.

## Git

- Work on the assigned branch only.
- Do not edit unrelated files.
- Summarize changed files after completion.
- Report failed tests honestly.
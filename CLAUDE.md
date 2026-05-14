# CLAUDE.md — Working Brief for the KNGO SEO Platform

> Read this file at the start of every session. It overrides default assumptions about how to work in this codebase.

---

## Project context

This is the **KNGO SEO Platform** — a multi-client SEO management app for KangoMedia. Next.js 16 (App Router), Prisma + Postgres, NextAuth v5, self-hosted on Coolify/Vultr.

Two reference documents live one level up at the workspace root and you should read them when the work touches their domain:

- `../kngo-platform-architecture.md` — the original architecture and module plan. Schema, integrations, roles, modules.
- `../kngo-platform-audit.md` — the May 2026 audit. Identifies the structural causes of recurring bugs and the hardening sprint that fixes them. **This is the active plan. Follow it.**

If anything in this file conflicts with those docs, those docs win.

Also see `AGENTS.md` in this directory for Next.js–specific warnings (the installed version has breaking changes from older training data; read `node_modules/next/dist/docs/` before writing framework code).

---

## Current phase: HARDENING SPRINT (pre-launch)

We are **not adding new features**. We are working through the audit's hardening plan in order:

1. **Week 1** — Type & validate boundaries (add Zod, eliminate JSON-as-text columns, pin DB workflow)
2. **Week 2** — Build the safety net (Vitest, 8–10 integration tests against a real test DB, CI gate)
3. **Week 3** — Surgical fixes to hotspots (break up `content/page.tsx`, fix auth gaps, consolidate HTTP)

When I start a session, ask me which phase/step we're on if it's not obvious. Don't guess and don't jump ahead.

If I ask for a new feature during this sprint, **push back** and remind me of the hardening plan. Confirm I want to suspend the sprint before doing feature work.

---

## Hard rules — non-negotiable

### 1. No new `JSON.parse(...) catch { return [] }` patterns

The codebase has 57 of these. They are the #1 source of whack-a-mole bugs. When you encounter one or are tempted to add one:

- Add a typed parser to `src/lib/parsers.ts` (create the file if it doesn't exist).
- The parser returns the validated shape or a clearly-named default.
- Replace the inline parse with a call to the parser.
- Grep for other instances of the same pattern (e.g. `JSON.parse(client.competitors`) and convert them too — don't leave half-migrated parsers.

Preferred long-term fix: if the column should be a relation, finish the migration to a structured table (e.g. `Competitor` for `Client.competitors`) and delete the JSON column.

### 2. All API route bodies must be validated with Zod

Zero routes currently use Zod. When you touch a route — even for an unrelated fix — add a Zod schema for its body and use a shared `validateBody(schema)` helper. If the helper doesn't exist yet, create it in `src/lib/validate.ts`.

Never trust `await request.json()` as anything other than `unknown`. The TypeScript types around it are wishes, not guarantees.

### 3. Schema changes go through `prisma migrate dev` — never `prisma db push`

We had a schema-drift incident on 2026-05-08 (see migration `20260508_recover_missing_columns`) caused by mixing `migrate` and `db push`. Don't repeat it. Every schema change must produce a migration file. In production, only `prisma migrate deploy` runs.

When proposing a schema change, also:
- Grep for all read sites of the affected column/relation before changing it.
- Show me the list and the migration plan before writing the migration.
- If a column is being removed, the read sites must be updated in the same PR.

### 4. When fixing a bug, write a failing test first

Once Vitest is set up (Week 2), every bug fix follows this order:

1. Reproduce the bug with a failing integration test.
2. Make the test pass.
3. Don't delete the test.

This is how the whack-a-mole stops. Until Vitest is set up, at least *describe* the test that would catch it.

### 5. Don't add to mega-files — break them up

These files are the highest-risk surfaces in the codebase:

| File | Lines | Why it's dangerous |
|---|---|---|
| `src/app/agency/clients/[clientId]/content/page.tsx` | 3,072 | 55 hooks in one component; grep flags it as binary (stray non-text char) |
| `src/app/agency/clients/[clientId]/page.tsx` | 2,089 | 7 copies of the same `JSON.parse(icpPains)` block |
| `src/app/agency/clients/page.tsx` | 1,374 | 44 hooks |
| `src/lib/keyword-intelligence.ts` | 1,047 | Mixed responsibilities (seeding, filtering, scoring, AI prompting) |
| `src/app/api/clients/[clientId]/discover/route.ts` | 903 | Auth + DB + background pipeline + audit polling + email in one file |

If I ask you to add behavior to one of these, **propose a split first** before adding more code. The split itself can be its own PR.

### 6. Outbound HTTP goes through the wrapper

All DataForSEO calls go through `src/lib/dataforseo.ts`'s `fetchWithRetry`. The audit route currently bypasses it (`discover/route.ts:340`) — that's the only known exception and it should be fixed when we get there. Don't add new direct `fetch()` calls to external APIs.

When wrapping a new external API, Zod-validate the response shape too. If the API changes silently, we want to fail loudly at the boundary, not three modules downstream.

---

## Workflow expectations

### Before changing code

- Read the relevant section of the audit if you haven't already in this session.
- For non-trivial changes, propose the plan first (files touched, migration plan, test plan). Wait for confirmation.
- Grep before assuming. The JSON-column pattern means consumers of a field are often in surprising places.

### While changing code

- Prefer editing existing files over creating new ones, unless a split is justified.
- Don't leave half-migrated state. If you convert one `JSON.parse(competitors)` site, convert all of them in the same change.
- Don't commit `console.log` debugging. `console.error`/`console.warn` for real errors is fine.
- Don't leave commented-out code. If it's dead, delete it. If it's not dead, it shouldn't be commented.

### After changing code

- Run `npm run build` and `npm run lint` and confirm they pass before reporting done.
- Once Vitest is set up, run the test suite too.
- If you discover an unrelated issue while working, note it in the chat — don't silently fix it (changes outside the stated scope cause regressions).

### What "done" means

A task is done when:
1. The code compiles and lints clean.
2. Tests pass (once we have tests).
3. The behavior was actually verified, not just "should work."
4. Any half-migrations were finished or explicitly punted with a note.

---

## Auth & security notes

Two known gaps to keep in mind (and fix when we hit them in the sprint):

- **`src/middleware.ts:18–19`** — `/api/debug/` is exempted from auth at the middleware level. The snapshot route gates itself with `DEBUG_TOKEN`, but any new route under `/api/debug/*` will be public-by-default. Either remove the exemption or assert `DEBUG_TOKEN` is set on app startup.
- **`src/app/api/clients/[clientId]/discover/route.ts:255–257`** — the GET handler has its session check commented out. Any logged-in user (including a `CLIENT` role) can poll any other client's discovery status. Fix before launch.

Don't ship features that depend on these gaps. Don't introduce similar patterns elsewhere.

---

## Domain quirks worth knowing

- **`serviceAreas` vs `primaryServices`** — `serviceAreas` = geographic regions ("Northern Colorado"). `primaryServices` = the actual services sold ("custom websites"). Distinct fields, distinct semantics. The wizard historically wrote services to both — don't perpetuate that.
- **`Client.competitors` is deprecated** — use the `Competitor` table. The JSON column is kept for backward-compat reads only. New code must not write to it. Finishing this migration is part of the hardening sprint.
- **Discovery pipeline runs as fire-and-forget** for 3–8 minutes after a 202 Accepted (see `discover/route.ts`). This is intentional — past Cloudflare's 100s proxy timeout. Don't refactor to synchronous.
- **DataForSEO `intersections` parameter** was removed by their API; sending it returns error 40506. See comment in `lib/dataforseo.ts` around line 182.

---

## Conventions

- TypeScript strict mode. No `any` unless commented why.
- Server components by default; `"use client"` only when needed.
- Prisma access only through `src/lib/prisma.ts` (the singleton). Never instantiate `PrismaClient` elsewhere.
- All client-scoped queries must include `clientId` in the `where` clause. Never trust that a parent query already filtered — this is the boundary that prevents cross-client data leakage.
- Auth checks at the top of every API route (until middleware is hardened to cover API routes too).
- Money is `Float` for now (`avgCpcUsd`, `cpc`); acceptable at this scale, revisit if precision bugs appear.

---

## When in doubt

Ask. Don't guess. The audit is the source of truth for what the right shape of work looks like right now.

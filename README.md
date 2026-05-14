# KNGO SEO Platform

Multi-client SEO management app for KangoMedia. Self-hosted on Coolify/Vultr.

**Stack:** Next.js 16 (App Router), Prisma + Postgres, NextAuth v5, TypeScript, Tailwind v4.

For working norms during the pre-launch hardening sprint, read [CLAUDE.md](./CLAUDE.md) first. The reference docs at the workspace root explain the architecture (`../kngo-platform-architecture.md`) and the active hardening plan (`../kngo-platform-audit.md`).

---

## Getting Started

```bash
npm install
npm run dev
```

App boots at <http://localhost:3000>.

Required env vars (see `.env.example`):

- `DATABASE_URL` — Postgres connection string
- `AUTH_SECRET` — NextAuth signing secret
- `ANTHROPIC_API_KEY` — Claude API key (used for keyword research, content generation)
- `ANTHROPIC_MODEL` — optional override (default `claude-sonnet-4-6`)
- `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` — DataForSEO API creds
- `DEBUG_TOKEN` — required if any `/api/debug/*` route is used in prod

---

## Database workflow

**Use `prisma migrate dev` locally and `prisma migrate deploy` in Coolify. Do not use `prisma db push` against any database the app cares about.**

We had a schema-drift incident on 2026-05-08 (see migration `20260508_recover_missing_columns`) caused by mixing the two. Don't repeat it.

```bash
# Make a schema change → generate a migration file
npx prisma migrate dev --name <descriptive_name>

# In production (handled automatically on Coolify deploy)
npx prisma migrate deploy
```

Before proposing a schema change:
1. Grep for all read sites of the affected column / relation.
2. Show the list and the migration plan before writing the migration.
3. If a column is being removed, update the read sites in the same PR.

---

## Conventions

### Request body validation — `validateBody`

Every POST/PUT/PATCH route declares a Zod schema for its body and runs it through `validateBody`:

```ts
// src/app/api/example/route.ts
import { z } from "zod";
import { validateBody } from "@/lib/validate";

const ExampleSchema = z.object({
  name: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

export async function POST(request: Request) {
  const validated = await validateBody(request, ExampleSchema);
  if (validated instanceof NextResponse) return validated;
  // `validated` is now strongly typed.
}
```

`validateBody` returns either the parsed body (typed) or a `NextResponse` with a 400 + structured `issues` array. Never trust `await request.json()` directly — its return type is `any`, which TS will gladly let you destructure into a lie.

### JSON-column reads — `parsers.ts`

Some Prisma columns store JSON-encoded strings (legacy shape, being migrated to relations where appropriate). **Don't write inline `try { JSON.parse(raw || "[]") } catch { return [] }` blocks.** Use the typed parser instead:

```ts
import { parseClientServiceAreas } from "@/lib/parsers";

const areas = parseClientServiceAreas(client.serviceAreas);
```

Each parser is Zod-validated and logs a `[parsers]` warning on shape mismatch so legacy/corrupt rows are findable. When a JSON column's shape evolves, edit the parser in one place rather than chasing 57 callsites.

If you're adding a new JSON column or noticing a shape that doesn't have a parser yet, add it to `src/lib/parsers.ts` before consuming the column.

### Outbound HTTP — `lib/dataforseo.ts`

DataForSEO calls go through `fetchWithRetry` in `src/lib/dataforseo.ts`. Don't add new direct `fetch()` calls to external APIs — Zod-validate the response shape too when you wrap a new API.

---

## Scripts

```bash
npm run dev     # local dev server
npm run build   # production build
npm run start   # serve production build
npm run lint    # ESLint
```

Vitest + integration tests land in Week 2 of the hardening sprint (see `../kngo-platform-audit.md`).

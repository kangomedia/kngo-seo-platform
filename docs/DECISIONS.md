# KNGO SEO Platform — Decisions & Change Log

A running record of architectural decisions, deployment context, and significant changes. Read this first when starting a new working session.

---

## 1. Project overview

**KNGO SEO Platform** — A multi-client SEO management application for **KangoMedia** (a digital agency). Built to:

- Onboard service-business clients
- Run on-page audits (DataForSEO)
- Discover keywords (DataForSEO + Claude AI)
- Generate content plans (blog posts, GBP posts, Q&As, press releases)
- Send drafts to clients for review via a token-based portal
- Publish approved content to the client's WordPress site

**Stack:** Next.js 16 (App Router) · React 19 · Prisma 7 · PostgreSQL · NextAuth v5 · Tailwind 4 · Anthropic Claude (Sonnet 4.6) · DataForSEO · Mailgun

**Operator model:** Single agency operator (Freddy at KangoMedia). The platform is *not* multi-tenant for the agency role — there is one admin who manages all clients.

---

## 2. Deployment context

| | |
|---|---|
| Host | Vultr |
| Orchestration | Coolify (manages Docker container + env vars) |
| Reverse proxy | Coolify's Traefik + Cloudflare in front |
| Database | PostgreSQL (Coolify-managed) |
| TLS termination | Cloudflare |

**Why this matters for code:** the upstream connection from the proxy to the Next.js container is HTTP, not HTTPS, so cookies must NOT be flagged `Secure`. This is opted into via `AUTH_INSECURE_COOKIES=true` (see Section 4).

---

## 3. Required environment variables

All credentials and config live in env vars. There are **no admin UI pages** for entering API keys — that was a deliberate decision (Section 4).

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Yes |
| `AUTH_SECRET` | NextAuth v5 JWT signing secret. **Not** `NEXTAUTH_SECRET` — that name is legacy. | Yes |
| `NEXTAUTH_URL` | Canonical app URL (e.g. `https://seo.kangomedia.com`) | Yes |
| `AUTH_INSECURE_COOKIES` | Set to `"true"` because we're behind a TLS-terminating proxy. Cookies will be issued without the `Secure` flag. Leave unset elsewhere. | Yes (this deploy) |
| `AUTH_DEBUG` | `"true"` to enable verbose NextAuth logs. Leave off in prod. | No |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM. Used to encrypt per-client WordPress Application Passwords at rest. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. | Yes |
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | DataForSEO API credentials | Yes |
| `ANTHROPIC_API_KEY` | Claude API key | Yes |
| `ANTHROPIC_MODEL` | Override the model. Defaults to `claude-sonnet-4-6`. Pin to a snapshot if you need stability. | No |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth for binding GSC + GA4 properties | If using Google integration |
| `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` / `MAILGUN_FROM_EMAIL` | Transactional email | If sending email |
| `GHL_API_KEY` / `GHL_LOCATION_ID` | GoHighLevel CRM (not yet used) | No |
| `DEBUG_TOKEN` | Token for the read-only `/api/debug/*` snapshot endpoints. Leave unset to keep the routes closed (they 503 without it). Rotate after sharing. | No |

`.env.example` in the repo root is the source of truth; keep it in sync.

---

## 4. Architectural decisions (with rationale)

### D1. Credentials in env, not in DB
**Decision:** All API keys live in env vars only. No admin page accepts them. The DB columns for `dataforseoLogin`, `dataforseoPwd`, `claudeApiKey`, `ghlApiKey` exist but are deprecated (kept for now to avoid a migration).
**Why:** Single operator who controls deployment. Coolify env-var management is the canonical store. UI for keys was a security risk and conceptually duplicate.
**Consequence:** Settings page shows env-var status (✓/✗) but no inputs.

### D2. NextAuth v5 with `AUTH_SECRET`
**Decision:** Standardized on `AUTH_SECRET` (NextAuth v5 convention), not `NEXTAUTH_SECRET`.
**Why:** `.env.example` and middleware were inconsistent — caused silent JWT validation failures.

### D3. Insecure cookies opt-in
**Decision:** Cookies have the `Secure` flag in production by default. Behind a TLS-terminating proxy, set `AUTH_INSECURE_COOKIES=true` to opt out.
**Why:** Coolify/Traefik upstream is HTTP. Without this, cookies don't get sent.

### D4. Prisma migrate, not `db push`
**Decision:** The Docker entrypoint runs `prisma migrate deploy` against versioned migrations. It detects three states (empty DB, schema-without-migrations, healthy) and bootstraps appropriately.
**Why:** `db push --accept-data-loss` could silently destroy customer data on schema drift. The smart entrypoint also baselines the pre-existing migrations from before the `db push` → `migrate` transition (hardcoded `PREBASELINE` list in `docker-entrypoint.sh`).

### D5. WordPress publishing per-client, AES-256-GCM at rest
**Decision:** Each client stores `wpUrl`, `wpUsername`, and an AES-encrypted `wpAppPasswordEnc`. The `/agency/wordpress` page lets the admin verify + save credentials and trigger publishes.
**Why:** WordPress Application Passwords are per-site; can't go in env. Encryption uses `ENCRYPTION_KEY` env var so the DB alone leaks nothing.

### D6. ANTHROPIC_MODEL is configurable, current default is Sonnet 4.6
**Decision:** All Claude calls read `process.env.ANTHROPIC_MODEL` with a default of `claude-sonnet-4-6`. Wrappers retry up to 3× on transient failures (ETIMEDOUT, ECONNRESET, 429, 5xx) with explicit 90-second timeout.
**Why:** Hardcoded `claude-sonnet-4-20250514` was the deprecated snapshot, causing silent fetch failures. Retry handles long-generation flakiness.

### D7. Generated drafts go to DRAFT_REVIEW (agency review), not auto-sent to client
**Decision:** Clicking "Generate Draft" sets `status=DRAFT_REVIEW`. The client only sees the draft after an explicit "Send Drafts for Review" click, which transitions DRAFT_REVIEW → CLIENT_REVIEW and triggers the email.
**Why:** Original behavior auto-sent and showed a "Drafts sent" banner that was a lie (no email actually went out). Agency needs control over when drafts ship.

### D8. Client portal active queue = unreviewed pieces only
**Decision:** When a client opens their plan-review link, the queue shows ONLY pieces with no DB-persisted decision. Already-approved/rejected/saved pieces never re-appear.
**Why:** Forcing the client to re-click through previously-decided pieces (a) wastes their time and (b) can cause them to submit before reaching the new pieces. The "X of N approved" counter still includes prior approvals.

### D9. Rejection restoration is admin-only
**Decision:** Clients see Approve / Request Edits / Reject (no "Later"). Restoring a rejected piece is via the agency's "Rejected & Saved Ideas" panel on the content page, calling `POST /api/content/pieces/[id]/restore`.
**Why:** Client-side restore made the role boundary fuzzy. The agency wants control: client requests, admin decides.

### D10. WordPress publish supports draft + publish modes
**Decision:** `POST /api/content/pieces/[pieceId]/publish` accepts `{ status: "draft" | "publish" }`. Default is `"draft"` so a human can review on-site before going live. On success, persists `publishedUrl` and flips piece status to PUBLISHED.

### D11. Public report links can expire
**Decision:** `Report` model has `expiresAt`. The public `/api/reports/[uuid]` route returns 410 Gone if expired. Existing reports with NULL `expiresAt` keep their behavior (no expiry).

### D12. Deliverable uniqueness enforced at DB
**Decision:** `@@unique([clientId, year, month, name])` on Deliverable. Idempotent creation via `createMany({ skipDuplicates: true })`.
**Why:** Race conditions in content generation were producing duplicates. Cleanup script `clean_deliverables.ts` was deleted in favor of the unique constraint.

### D13. Audit polling has a CAS lock
**Decision:** The polling endpoint uses `updateMany` with a status guard (`status: { in: ["CRAWLING", "PENDING"] } → "PROCESSING"`) to atomically claim a finished crawl. Concurrent polls can no longer double-process.

### D14. Reserves auto-promote in primary selection
**Decision:** `selectPrimaryPieces` walks pieces in sortOrder, skips rejected/saved, and fills the per-type quota with the first N non-rejected pieces. So when a primary is rejected, the next reserve becomes the new primary automatically.
**Why:** Plan generation creates 2× the quota for new plans (so reserves exist). The client should see fresh content after rejecting, without manual agency intervention.

### D15. Keyword research filter pipeline (Path A)
**Decision:** Keywords go through: dedup → negative patterns → audience filter → gibberish filter → intent filter → relevance pre-scoring → AI scoring (Claude, score ≥5 to pass) → strategic analysis. Final cap is 40 keywords.
**Why:** Original output was noisy ("online courses", "web design website design", etc.) because filters were too lenient. See `docs/DECISIONS.md` Section 6 (Path A) for full breakdown.

### D16. Path B (topic-strategy layer) is the next major project
**Decision:** Keyword research is downstream of topic strategy, not the entry point. A future refactor will introduce a `TopicCluster` model with funnel-stage awareness (TOFU/MOFU/BOFU) sitting between business profile and keyword research.
**Why:** Path A fixes keyword quality but the deeper architectural issue is sequence — strategy should drive keywords, not the other way around. See Section 7.

### D17. ROI is reported as estimated traffic value, not vanity metrics
**Decision:** Client-facing reporting leads with **non-branded clicks × per-client `avgCpcUsd`** as "Estimated Traffic Value" (in dollars). Rankings and impressions are demoted; engagement-event counts (`phone_click`, `form_submit`, `email_click`) come from GA4 events, not call/form attribution.
**Why:** Rankings are vanity for clients. Strict per-lead attribution requires CallRail/full conversion tracking that most clients won't or can't set up. Traffic value is the most defensible dollar figure SEO can claim — it answers "what would this cost in Google Ads?" without claiming leads it can't prove. Engagement events are reported as honest *signals*, not absolute leads. Live in [src/lib/performance.ts](../src/lib/performance.ts).

### D18. Per-URL content performance via on-the-fly join
**Decision:** Content performance ("which articles drove traffic?") is computed live by joining `ContentPiece.publishedUrl` to GSC `page` and `page+query` dimensions. No persistent per-piece performance table.
**Why:** GSC queries are cheap, the join is trivial, and the data is always fresh. The only data we *do* persist is the monthly aggregate (`MonthlySnapshot`) so 6+ month trends survive even if a client's GSC property is reconnected/changed.

### D19. MonthlySnapshot persists month-end aggregates
**Decision:** A `MonthlySnapshot` row per client per month captures GSC totals, GA4 totals, branded/non-branded split, engagement events, estimated traffic value, and JSON drill-down (`pageData`, `queryData`). Written by `snapshotMonth()` — idempotent, called from monthly report generation and quarterly report build.
**Why:** GSC only retains 16 months of data and GA4 properties get re-keyed during agency handoffs. The snapshot table is the trend-line of record. Without it, the quarterly story view degrades to "whatever GSC remembers."

### D20. Quarterly reports are narrative-first, not table-first
**Decision:** New `QUARTERLY` report type renders an AI-generated narrative paragraph as the primary content, followed by trend chart + top-5 content list. Generated via Claude (`generateNarrative`) with a non-technical-owner system prompt. Falls back to a deterministic summary if Claude fails.
**Why:** Monthly reports are operational ("what happened"); quarterly reports are persuasive ("why renew"). Story beats data when the audience is a small-business owner — but the story must be grounded in the actual snapshots, not invented.

### D21. Debug snapshot endpoint for external assistant inspection
**Decision:** `/api/debug/clients` (list) and `/api/debug/[clientId]/snapshot` (full bundle) are read-only routes gated by an `x-debug-token` header matched against the `DEBUG_TOKEN` env var. Built so the agency operator can pipe live state to an external assistant (e.g. Claude via WebFetch). Returns 8 buckets: client config, business profile, keywords, latest keyword research, active content maps, latest site audit, deliverables, recent activity.
**Why:** Strict NextAuth session gating breaks for tools that can't carry a session cookie; a single-purpose token header is the simplest secure path.
**Constraints:** Read-only Prisma queries only; no INSERT/UPDATE/DELETE. PII not masked — the token + non-public deployment are the security boundary. Set `DEBUG_TOKEN` in Coolify env. Rotate after each debugging session. Returns 503 if the env var is unset (closed by default — won't accidentally expose if env wasn't configured).

---

## 5. Feature inventory

### Pages (agency-facing, requires AGENCY_ADMIN auth)
- `/agency/dashboard` — overview
- `/agency/clients` — client list + onboarding wizard (3-step)
- `/agency/clients/[id]` — per-client dashboard
- `/agency/clients/[id]/analytics` — GA4 + GSC
- `/agency/clients/[id]/audit` — site audit results
- `/agency/clients/[id]/content` — content plan + drafts (large file: ~2.1k lines)
- `/agency/clients/[id]/deliverables` — monthly tracking
- `/agency/clients/[id]/rankings` — keyword rank tracking
- `/agency/clients/[id]/reports` — monthly + baseline + audit reports
- `/agency/clients/[id]/research` — manual keyword research
- `/agency/content-queue` — content approval workflow
- `/agency/deliverables` — cross-client view
- `/agency/wordpress` — per-client WP publishing
- `/agency/settings` — read-only env-var status panel
- `/agency/tools/url-crawl` — domain crawler

### Public surfaces
- `/login` — credential login
- `/client/[token]/*` — client portal (token-based, no login)
- `/report/[uuid]` — public report viewer

### Major API routes
- Auth: `/api/auth/[...nextauth]`
- Clients: CRUD at `/api/clients` and `/api/clients/[id]`
- Discovery: `/api/clients/[id]/discover` (audit + keywords in parallel during onboarding)
- Audit: `/api/clients/[id]/audit*` (start, poll, recommendations)
- Keywords: `/api/clients/[id]/keywords*`, `/api/clients/[id]/research`
- Content: `/api/content/draft`, `/api/content/generate`, `/api/content/pieces/[id]*`, `/api/content/send-for-approval`, `/api/content/send-plan-for-approval`
- WordPress: `/api/clients/[id]/wordpress` (config), `/api/content/pieces/[id]/publish` (publish)
- Reports: `/api/reports/[uuid]` (public), `/api/clients/[id]/reports/*`
- Settings: `/api/settings` (env-status only)

---

## 6. Path A — Keyword research quality (✅ COMPLETE)

The keyword discovery pipeline was refactored in this session to address noisy output ("online courses for web development", "web design website design web development", etc.).

### What changed in [src/lib/keyword-intelligence.ts](../src/lib/keyword-intelligence.ts)
- **`filterByAudience`** — drops learner / DIY / job-seeker queries (course, tutorial, training, how-to-learn, diy, salary, jobs, intern, template, ebook, "what is X", etc.). Service-business audience only.
- **`filterByGibberish`** — drops keyword-stuffing artifacts (any non-stop-word that appears 2+ times triggers rejection).
- **`preRelevanceScore`** — replaces the old "top 100 by volume × CPC" sort. Boosts geo/buying-intent signals (city/state/near-me/hire/agency/services/cost), penalizes generic 1–2 word terms with no qualifier.
- **AI scorer prompt** — explicit local-service-business framing, full rubric (9–10 local money / 7–8 service commercial / 5–6 TOFU / 1–2 drop), pass threshold raised 4 → **5**, new group taxonomy: Local Money / Service Commercial / Vertical-Specific / Top-of-Funnel / Long-Tail Opportunity / Brand-Authority.
- **`generateAISeeds`** — Claude-driven seed generation. Replaces mechanical templates when an Anthropic key is set. Falls back to `generateSmartSeeds` on failure.

### What changed in [src/app/api/clients/\[clientId\]/discover/route.ts](../src/app/api/clients/[clientId]/discover/route.ts)
- Pipeline order: AI seeds → DFS suggestions → competitor gap → dedup → negative → audience → gibberish → intent → pre-relevance → AI scoring → strategic analysis.
- Final cap reduced 80 → **40**.

### What changed in the onboarding wizard ([src/app/agency/clients/page.tsx](../src/app/agency/clients/page.tsx))
- **Step 1** added: Business Description (textarea) + Price Range (select).
- **Step 2** added: Ideal Customer (textarea, prominent at top).
- The existing Industry Category dropdown now also writes to `industryVertical` (not just `gbpCategory`).
- The services input writes to BOTH `primaryServices` AND `serviceAreas`.
- Step 3 review surfaces the new fields.

### What changed in [src/app/api/clients/route.ts](../src/app/api/clients/route.ts) (POST)
- Persists `businessDescription`, `idealClientProfile`, `industryVertical`, `priceRange`, `primaryServices`. Back-compat fallbacks for legacy callers.

### What changed in [src/app/api/clients/\[clientId\]/research/route.ts](../src/app/api/clients/[clientId]/research/route.ts)
- Refactored end-to-end to use the same filter pipeline as discover.
- Switched from `keywords_for_keywords` to `keyword_suggestions` (returns `search_intent_info` so the intent filter has data).
- Reads the full `BusinessProfile` from the client.

---

## 7. Path B — Topic strategy layer (⏳ NOT STARTED)

The deeper architectural project. Keyword research being step #1 is the wrong sequence for service businesses; topic strategy should drive keyword research, not vice versa.

### Proposed shape
1. **Strategic intake (deeper onboarding):** add `painPoints`, `differentiators`, possibly customer-journey notes
2. **Competitive landscape analysis:** real fetch of what competitors rank for and publish, gap analysis (current "list 3 competitor URLs" is the placeholder)
3. **Topic strategy:** new `TopicCluster` model — pillar topic + funnel-stage focus + child content. Sits between business profile and keyword research.
4. **Keyword research scoped per cluster:** instead of one big flat list, each cluster gets its own focused 10–15 keywords
5. **`ContentPiece.funnelStage`:** new column. Every piece classified TOFU/MOFU/BOFU. Generator prompt changes per stage.
6. **Funnel-aware content plan:** "this month: 2 BOFU + 4 MOFU + 4 TOFU"

When ready to start Path B: design the `TopicCluster` schema first, then the strategic intake flow, then sequence-rewire discover.

---

## 8. Known follow-ups (lower priority)

- **138 console.log statements** in `src/`. Auth + middleware ones were stripped. The rest (audit polling, content generation, keyword discovery debug) are still there. Consider replacing with a structured logger (pino) when log volume becomes an issue in Coolify.
- **No tests.** The platform has zero unit/integration tests. Critical paths (auth, audit polling, draft generation, plan submit) deserve coverage. Out of scope for current work.
- **`isReserve` flag is dead code.** The schema has it but the generator always sets `false`. Can be removed when convenient — `selectPrimaryPieces` uses sortOrder + approval state instead.
- **Massive page components.** `agency/clients/[clientId]/content/page.tsx` is ~2,100 lines, `agency/clients/[clientId]/page.tsx` is ~1,700 lines. Functional, but a maintainability issue.
- **Public report URLs have no rate limit.** UUID guess is impractical but adding rate limiting would be defense-in-depth.
- **Client portal `accessToken` has no expiry/rotation.** Same UUID forever. If a token leaks (forwarded email), permanent access.

---

## 9. Recent change log

This session's work, in order:

1. **Production-readiness pass** (env vars, auth, migrations, encryption, audit race condition, deliverable dedup, DataForSEO retry, deletion of stale files, removal of admin UI for API keys, AUTH_SECRET standardization, public report expiry).
2. **WordPress publishing** (encryption helper, lib/wordpress.ts, /api/clients/[id]/wordpress, /api/content/pieces/[id]/publish, /agency/wordpress page).
3. **Migration recovery** (idempotent `20260508_recover_missing_columns` migration to fix a baselining bug).
4. **Email "drafts sent" banner inaccuracy** (changed status flow: drafts go to DRAFT_REVIEW first, only enter CLIENT_REVIEW on explicit Send).
5. **Client portal draft review redesign** (renders body markdown, removed "Later", added "Request Edits" with revision tracking).
6. **Client portal plan review fixes** (counter shows approved-only, queue excludes already-decided pieces, restore is admin-only).
7. **Anthropic model fix** (deprecated `claude-sonnet-4-20250514` → `claude-sonnet-4-6` via `ANTHROPIC_MODEL` env, with retry + timeout wrapper).
8. **Path A keyword pipeline overhaul** (audience + gibberish filters, geo-weighted pre-scoring, stronger AI prompt, Claude-generated seeds, wizard expanded with business profile fields, research endpoint refactored).
9. **Performance & ROI layer** (D17–D20). New `MonthlySnapshot` Prisma model (migration `20260507_add_performance_tracking`), `Client.brandTerms` + `Client.avgCpcUsd` config fields, `src/lib/performance.ts` with branded-query split + per-URL content performance + traffic-value math + monthly snapshot writer, new `/api/clients/[id]/performance` route, new `/agency/clients/[id]/performance` page, ROI hero + content performance + branded-split sections in `MonthlyReport`, new `QuarterlyReport` component with AI narrative, public report viewer routes the new `QUARTERLY` type, client portal token-page gets a results hero block + content-performance list.

---

## 10. How to start a new working session

1. Read this doc top-to-bottom.
2. Read [ROADMAP.md](../ROADMAP.md) for product-level context.
3. Check Coolify env vars are still aligned with Section 3.
4. `cd kngo-seo-platform && npm install && npx prisma generate && npm run dev` to run locally.
5. If picking up Path B: start with the `TopicCluster` schema design.
6. If something's broken: check the entrypoint logs in Coolify (`docker-entrypoint.sh` is verbose); migration state issues are the most likely root cause.

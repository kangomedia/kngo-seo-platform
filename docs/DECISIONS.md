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
**Constraints:** Read-only Prisma queries only; no INSERT/UPDATE/DELETE. PII not masked — the token + non-public deployment are the security boundary. Set `DEBUG_TOKEN` in Coolify env. Rotate after each debugging session. Returns 503 if the env var is unset (closed by default — won't accidentally expose if env wasn't configured). Middleware bypasses `/api/debug/*` so the token header is the only gate.

### D23. Per-query CPC for traffic-value math, not a flat per-client number
**Decision:** Estimated traffic value is now `Σ(clicks_q × cpc_q)` over non-branded GSC queries, with CPC sourced from a `KeywordCpc` cache table populated on demand from DataForSEO Google Ads. Falls back to a weighted-average CPC across the same period's priced queries, then to `Client.avgCpcUsd` if both fail. The summary now exposes `cpcSource: "per-query" | "derived-average" | "client-fallback" | "none"` so the report can be honest about how the number was computed.
**Why:** A flat $3.50 default was wrong by 10× in either direction depending on the keyword mix. Per-query CPC is defensible to a non-technical client ("computed from DataForSEO advertiser data") in a way the flat number wasn't. Cost is negligible — ~$0.05 per 1000 keywords with a 30-day cache.
**Constraints:** `KeywordCpc` is keyed on `(keyword, locationCode)`; default location is 2840 (US). Per-client location resolution is a TODO. The cache also stores nulls so we don't repeat-query DataForSEO for terms with no advertiser data.

### D24. Wizard: serviceAreas ≠ primaryServices, plus ICP-pain capture
**Decision:** The onboarding wizard now writes only to `primaryServices`. `serviceAreas` is reserved for explicit geographic regions (separate from `targetCities`, which are individual cities) and left empty by default. New `icpPains` field on `Client` (JSON array of pain-point strings) captured via a tag list in the wizard — drives pain-point keyword research downstream.
**Why:** The wizard previously wrote the same array to both `serviceAreas` and `primaryServices`. The semantic confusion was visible in the debug snapshot for KangoMedia (services list and "areas" list were identical). ICP pains weren't captured at all, leaving demand-creation research with no input.

### D25. Structured Competitor table + AI classification
**Decision:** Replaced the legacy `Client.competitors` JSON array with a `Competitor` table that carries classification (PEER, PLATFORM, DIRECTORY, MARKETPLACE, TIER_MISMATCH, ADJACENT, IRRELEVANT), reasoning, optional pillar tag, and an `isAccepted` flag. New endpoint `POST /api/clients/[id]/competitors/discover` pulls SERP-overlap candidates from DataForSEO `competitors_domain` and asks Claude to classify each relative to the agency profile + ICP. PEER auto-accepts; everything else requires manual flip. The legacy `Client.competitors` JSON column is kept readable for back-compat; new client creation backfills both. Migration backfills existing JSON arrays into Competitor rows on first run.
**Why:** Every existing SEO tool dumps Yelp/Wix/GoDaddy/Clutch into the competitor list. They're not peers, and including them poisons keyword research (the seeds and scrape targets get diluted). AI classification is the right tool for "is this domain a peer agency?" — judgment-heavy and context-dependent.
**Surfaces:** New `CompetitorPanel.tsx` lives at the top of the Research page. The wizard writes manually-typed competitors to the table on creation with `source: "wizard"`.

### D26. Pain-point research mode (demand-creation, ICP-driven seeds)
**Decision:** New endpoint `POST /api/clients/[id]/research/pain-point` runs a parallel research pipeline that auto-generates seeds from the client's `icpPains` + business profile (no user-supplied seeds), uses a *lighter* filter pipeline (skips audience + intent filters, keeps low-volume informational queries, threshold ≥50 monthly searches), and persists results with `mode: "PAIN_POINT"`. Cap raised to 60 keywords (vs 40 for service research) since the funnel is wider.
**Why:** Service-mode research is biased toward solution keywords and the agency's existing competitors — it misses the entire demand-creation surface (pain-aware queries, comparison/alternative searches, "how to" educational queries). For an agency selling automation services to people who don't yet know they need automation, the only way to find traffic is to target the *pain*, not the *solution*. Closes the gap noted in the KangoMedia debug snapshot ("automation pillar is invisible to the keyword pipeline").

### D27. Multi-research content-map merging
**Decision:** Content map generator now folds keywords from multiple `KeywordResearch` rows by default — accepts `researchIds[]` array (or single `researchId` for back-compat), or falls back to merging the 5 most recent research sessions for the client. Each keyword in the prompt is tagged with `[SERVICE]` or `[PAIN]` based on the research's `mode`, so Claude builds pillars that span both demand-capture and demand-creation. Cap raised from 50 to 80 keywords passed to the prompt to give Claude visibility into the full pool.
**Why:** A single content map should reflect the client's *whole* business, not just one keyword research run. KangoMedia's web/SEO pillar research and automation/pain-point research need to merge into one strategy where pillars can cover both revenue lines. This is the gluing step that makes pain-point research useful — without it, the pain-point keywords would just sit in their own research blob, never reaching content planning.

### D22. Path B — Topic-strategy layer wired (ContentMap → ContentPiece promotion)
**Decision:** The `ContentMap` model is now the entry point for ongoing content work. New "Strategy" tab in the Content Hub (default tab) displays the active map: pillars (4–6), funnel-stage tagged pieces (TOFU/MOFU/BOFU), 6-month pacing, quick wins. Each piece has a "Promote" button that creates a `ContentPiece` in the current month's `ContentPlan` (creating the plan on demand). Promotion is idempotent — flags `promoted: true` and `contentPieceId` in the map JSON. The seed-keyword "Topical Content Generator" is demoted to a "Quick Generate" tab for ad-hoc one-offs. Client portal shows a read-only roadmap with pillar progress bars + monthly theme strip + AI summary.
**Why:** The original design generated 10 blogs / 8 GBP / 8 QAs / 1 PR from a single seed keyword each month — produced disconnected batches with no through-line, no pillar authority, no funnel pacing. The map-as-strategy + plan-as-curated-subset design produces internal-linking compound effects, predictable monthly pacing, and a story the client can follow ("you're in month 3 of 6"). Closes D16 ("Path B is the next major project").
**How it works:**
- `/api/clients/[id]/content-map` POST prompt now requires `funnelStage`, `pillarSlug`, `monthIndex`, `priority`, `id`, `promoted` on every piece. Server normalizes Claude's output to guarantee these fields exist.
- `/api/clients/[id]/content-map/active` GET returns the most recent active map.
- `/api/clients/[id]/content-map/promote` POST/DELETE moves pieces in/out of `ContentPlan`. Creates the plan on demand. Idempotent.
- Strategy tab (`StrategyTab.tsx`) is the new default surface in Content Hub. AI Generator demoted to "Quick Generate" tab for non-strategy use.

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
10. **Debug snapshot endpoint** (D21). Token-gated read-only routes at `/api/debug/clients` and `/api/debug/[clientId]/snapshot` exposing 8 buckets for external-assistant inspection. `DEBUG_TOKEN` env var added; middleware bypasses `/api/debug/*` so the route's own token check is the gate.
11. **Path B — Topic strategy layer wired** (D22). Promoted `ContentMap` from orphaned data to first-class strategy surface. Upgraded content-map prompt with funnel-stage/pillar/month tagging. New `/api/clients/[id]/content-map/active` (GET) and `/api/clients/[id]/content-map/promote` (POST/DELETE) routes. New `StrategyTab.tsx` in Content Hub (now the default tab); AI Generator demoted to "Quick Generate". Client portal gets a read-only 6-month roadmap section with pillar progress bars and monthly themes. Closes D16.
12. **Strategy upstream overhaul** (D23–D27, migration `20260508_full_strategy_layer`). Per-query CPC + cache table (D23). Wizard fields fixed + ICP-pain capture (D24). Competitor model + AI classification + Competitor Intelligence panel on the Research page (D25). Pain-point research mode endpoint + ICP-driven seed generator (D26). Multi-research content-map merging — pillars now span service + pain-point research (D27). Schema additions: `Keyword.cpc`, `Client.icpPains`, `KeywordResearch.mode` + `KeywordResearch.pillarSlug`, new `KeywordCpc` cache table, new `Competitor` table (with backfill from legacy `Client.competitors` JSON).
13. **Strategy generation truncation fix** (D28). The content-map POST was capping Claude at `max_tokens: 4000`, which truncated the JSON mid-stream for any strategy with 30–60 pieces. The code silently stored `{ raw, error }` as `mapData` and the aiSummary call (run on the truncated raw text) still produced a plausible-looking summary — so the UI rendered "0 pillars · 0 pieces" alongside a written executive summary that named pillars by hand. Fix: bumped `max_tokens` to 16000, check `stop_reason === "max_tokens"` and surface it, throw on JSON parse failure or empty pillars+quickWins (preserving the previously active map instead of saving a broken one), and StrategyTab now shows an explicit "this strategy didn't generate any pillars" banner when an active map has 0 of both.
14. **Strategy generation Cloudflare 524 fix** (D29). With the token cap raised, the full Claude call now takes 60–180s end-to-end, which exceeds Cloudflare's 100s default origin timeout on Free/Pro plans → users saw `HTTP 524` in the UI. Fix: rewrote `/api/clients/[clientId]/content-map` POST as an NDJSON streaming response. It emits `{"type":"started"}` immediately so Cloudflare sees first byte within the timeout window, heartbeats every 15s during Claude work, and finishes with `{"type":"done", ...}` or `{"type":"error", message}`. Headers `Content-Type: application/x-ndjson`, `Cache-Control: no-cache, no-transform`, and `X-Accel-Buffering: no` keep both Cloudflare and Traefik from buffering. Both callers (`StrategyTab.regenerate` and the research page's `handleGenerateContentMap`) were updated to read the stream line-by-line and act on the final event.
15. **Strategy quota awareness + UX polish** (D30). Four related fixes to the Content Hub Strategy tab. (a) The prompt now states hard per-type minimums computed from `monthlyCapacity × 6` (e.g. "BLOG_POST: 60 minimum, GBP_POST: 24 minimum, PRESS_RELEASE: 6 minimum") and explicit content-type guidance, fixing the prior behavior where Claude generated mostly BLOG_POSTs and skipped PRESS_RELEASE entirely. `max_tokens` bumped to 24000 to fit larger quotas. (b) Removed the auto-tab-switch from Strategy → Content Plan after promote; the page now stays on Strategy so the operator can continue selecting pieces. `loadData()` still fires so the Plan tab is fresh when navigated to. (c) StrategyTab now receives `clientLimits` and renders a per-type quota strip in the header (e.g. "Blog 3/60 · 57 left") that color-codes when a type is exhausted (amber) or over quota (red). (d) Added a Type filter row (All / Blog / GBP Post / GBP Q&A / Press Release) with counts, sitting alongside the existing Funnel and Month filters.
16. **Quota driven by package tier, not stored fields** (D31). The Client model has `monthlyBlogs`/`monthlyGbpPosts`/`monthlyGbpQAs`/`monthlyPressReleases` columns that are auto-copied from `TIER_DEFAULTS[tier]` at client creation and on Edit-form tier change. These can go stale if a tier is changed without resaving the form (KangoMedia's record was on PRO=Authority SEO but still showed 10/4/0/0 instead of 10/8/8/1). Fixed by deriving the effective quota at read time from `TIER_DEFAULTS[client.tier]` instead of the stored columns, in two places: (a) `/api/clients/[clientId]/content-map` route uses tier defaults to compute `monthlyCapacity` for the prompt; (b) `content/page.tsx` `loadData()` builds `clientLimits` from tier defaults — this propagates to both the StrategyTab quota strip and the Content Plan per-type capacity counts. Stored columns are kept as a fallback for unrecognized tiers and remain editable in the admin UI, but they no longer drive strategy generation or quota display. The package is now the source of truth.
17. **Strategy under-generation + monthly quota view** (D32). After D30 the prompt asked for "≥60 BLOG_POST, ≥48 GBP_POST, ≥48 GBP_QA, ≥6 PRESS_RELEASE" but Claude returned 43/6/6/0 — the "5–8 pieces per pillar" rule capped the model's output and it interpreted the minimums as aspirational. Fixed by computing the per-pillar piece distribution as exact integers (e.g. PRO tier → exactly 10 BLOG_POST + 8 GBP_POST + 8 GBP_QA + 1 PRESS_RELEASE = 27 pieces in each of exactly 6 pillars, totals = 60/48/48/6 + 5–10 quickWins). Locked pillar count to 6 (was 4–6). Added a FINAL VERIFICATION block at the end of the prompt that re-states the per-type count targets and tells Claude to add pieces until it hits them before responding. `max_tokens` raised to 40000 to fit the full ~170-piece output. Separately, the StrategyTab quota strip now switches between **monthly view** (denominator = monthly quota, counts filtered to pieces tagged with that monthIndex) when a specific month is selected, and **6-month total view** when ALL is selected. A label above the strip ("Quota for M2" vs "Quota (6-month total — pick a month above for monthly view)") makes the mode obvious. This addresses the operator confusion of seeing "50 blog posts left" when they only need 10 for the current month.
18. **Anthropic streaming to defeat Cloudflare 524 on long generations** (D33). After D32, the full PRO-tier strategy generates ~170 pieces and runs Claude for 3–6 minutes. Even with our 15-second NDJSON heartbeats (D29), users still hit `HTTP 524` because the blocking fetch to Anthropic held the response handler quiet long enough for Cloudflare's edge to bail. Fixed by switching the `/api/clients/[clientId]/content-map` POST to consume Anthropic's `stream: true` SSE response: each `content_block_delta` is parsed and the accumulated raw text is forwarded back through the existing NDJSON stream as `{"type":"progress","chars":N}` roughly every 200 characters. Cloudflare now sees bytes flowing continuously (every few hundred ms) for the whole generation, not just every 15s. The `stop_reason` is still captured (from `message_delta`) so `max_tokens` truncation is still detected. The 15s heartbeat interval is retained as a backstop in case Anthropic's stream stalls. Client side needs no changes — `progress` events are silently ignored by the existing reader loop that only acts on `done`/`error`.
19. **Phantom promotions from AI-set promoted flags** (D34). Users reported the StrategyTab quota strip showing pieces promoted that they never clicked promote on (e.g., "Press Release 6/6" with no PR pieces in the actual ContentPlan, "Blog 18/60" when the current month's plan only had 10 blog pieces). Claude was echoing `"promoted": true` from the example JSON or auto-marking high-priority pieces as already scheduled. The old normalize step (`p.promoted = p.promoted === true`) faithfully preserved those phantom flags, so the strip counted them while no corresponding ContentPiece row ever existed. Fixed by forcing `promoted = false` and clearing `contentPieceId` on every piece during normalize — fresh strategies always start unpromoted, and only the explicit `/content-map/promote` endpoint can flip the flag. Also clarified the Month filter label as "Suggested month:" (with a tooltip) so operators understand the M1-M6 tags are recommendations from Claude, not enforced scheduling — the actual publishing month is decided when the piece is promoted to a Content Plan.
20. **Target-month picker replaces Suggested-Month filter** (D35). The previous Strategy UI tangled two concepts: Claude's suggested `monthIndex` and the actual ContentPlan calendar month a piece would land in. Operators read the M1-M6 filter as a hard commitment ("if I'm filtering M1, why is this piece going to M3?"), the quota strip's "pick a month above" label pointed at filters that were actually below it, and the strip counted phantom `promoted` flags rather than real ContentPlan state. Replaced the M1-M6 filter buttons with a single **"Filling Content Plan for: [Month Year]"** dropdown that defaults to the current calendar month and lists the surrounding ±12 months plus any existing ContentPlan months. The dropdown is now the source of truth for: (a) the Promote action — the StrategyTab passes `{ month, year }` into the existing `/content-map/promote` endpoint so pieces land in exactly the chosen month; (b) the quota strip — denominator is the monthly quota and numerator is the count of actual ContentPiece rows in that month's plan, derived from the `plans` prop the parent now passes down. Each piece card shows "Claude suggests M3" as a subtle informational note instead of a prominent filterable badge. The Promote button label includes the target month (e.g. "Promote to May 2026") so the destination is unambiguous. The flat-pool browsing model also frees operators from monthIndex constraints — any piece can be promoted to any month, matching the operator's expectation that the strategy is a bank of suggestions, not a pre-scheduled calendar.
21. **Client-portal polish: plain-language summaries, no jargon, no per-month commitments, markdown rendering** (D36). Four related fixes to the client-visible surface. (a) **Executive summary prompt** rewritten for the `aiSummary` field — explicitly banned TOFU/MOFU/BOFU/GBP/CTA/SERP/"topical authority"/"keyword clusters" jargon, requires plain prose with no markdown headings or bullets, prescribes outcome-first phrasing, and avoids committing to specific months. Translates GBP → "Google Business Profile updates", BOFU/MOFU/TOFU → "ready to hire / comparison shoppers / researchers". (b) **Per-month cards removed from `/client/[token]` 6-Month Roadmap.** The "Month 1: …, Month 2: …, Month 3: …" grid that hard-coded a specific theme per month is gone. The "Your 6-Month Roadmap" framing stays (in the heading and the summary copy), and the pillar progress cards (now labeled "Focus Areas") remain. The `monthlyFocus` data is preserved in `mapData` for internal agency use. (c) **`stripMarkdown` helper** added to the client portal as a defensive belt — strips `##`, `**`, `__`, backticks, list markers from existing strategies' summaries so legacy data with markdown doesn't render as raw syntax. (d) **`BaselineReport` Strategic Analysis renderer** rewritten to properly handle `## H2`, `# H1`, `**inline bold**`, `` `inline code` ``, bullet lists, numbered lists, and `---` horizontal rules — the old inline parser only handled `**Bold**` standalone lines and treated everything else as raw paragraphs (which is why the `## Top Priority Keywords` heading appeared as literal hash marks). The corresponding `generateStrategicAnalysis` prompt was tightened to require `## H2` section headings, short 2–4 sentence paragraphs, and the same jargon ban. (e) **Reports publish/unpublish toggle.** The public `/api/reports/[uuid]` returns 404 when `isPublished=false` for security (drafts shouldn't be public), but there was no agency UI to flip the flag — the "Published" indicator was display-only. Extended the PATCH endpoint to accept `isPublished` and turned the static "Published" badge into a clickable toggle that says "Draft — click to publish" when unpublished. Fixes the "Report Not Found" scenario where a generated report sat in `isPublished=false` state with no recovery path.
22. **Sidebar TOC + jargon strip on client Content Review** (D37). The client-facing card-by-card review at `/client/[token]/content` forced clients to click Next/Back through 27+ pieces with no way to jump to a specific item or see the full slate by type. Added a left-rail sidebar (260px on desktop, stacks on mobile) grouped into four sections — Blog Posts → Google Business Posts → Google Profile Q&As → Press Releases — with a per-section "X / N approved" counter and a status dot next to every title (green = approved, red = rejected, amber = saved). Clicking any title jumps `currentIndex` directly to that card. The current card's title is highlighted in the rail. Sidebar is `position: sticky` so it stays in view while the right column scrolls. Separately, fixed a jargon leak: the promote endpoint at `/content-map/promote` was appending `_Pillar: Quick Wins_` and `_Funnel stage: TOFU_` to every ContentPiece's description as internal context — that text was reaching clients on the review portal verbatim. Removed the append; descriptions are now just Claude's outline. Added a `cleanDescription()` defensive strip on the client portal that removes those exact markers plus any naked TOFU/MOFU/BOFU mentions, so existing ContentPieces with the legacy metadata also render cleanly without requiring an agency to re-promote or rewrite them.
24. **Draft review: per-piece async + sidebar TOC + inline annotations + Markdown tables** (D39). Four related changes to the client-facing draft review at `/client/[token]/content`. (a) **Per-piece async approval.** Removed the "Submit All Decisions" batch button entirely; each Approve/Request Edits/Reject click now fires `submitPublicContentApproval` immediately, with a per-piece spinner on the button. Failed saves revert local state and show an inline error. After a successful decision, the queue auto-advances to the next un-decided piece. The "🎉 Thank You" submission screen is gone — replaced by an "All caught up" banner that appears once every piece has been reviewed. Decisions persist instantly so clients can close the tab and resume later without losing work. (b) **Sidebar TOC** (260px on desktop, stacks on mobile) ported from the plan-review flow. Groups pieces by content type (Blog → GBP Post → GBP Q&A → Press Release) with a status dot per item and a per-group counter ("4 / 10"). Click any title to jump directly. (c) **Highlight-and-comment annotations.** New `PieceAnnotation` Prisma model + migration `20260512_add_piece_annotations`. Three new server actions in `actions-public.ts`: `submitPublicAnnotation`, `getPublicAnnotations`, `deletePublicAnnotation` — all token-gated. In the UI, an `onMouseUp` handler inside the rendered body detects a non-collapsed selection of ≥3 chars, shows a floating "Comment on this" button above the highlighted text, and opens a modal composer with the selection quoted. Saved comments appear in an "Your comments on this draft" panel below the body. Clients can delete their own pending annotations; agency-resolved ones become read-only. (d) **Markdown table support** in `renderMarkdown` — GFM tables (`| a | b | / |---|---|`) now render as styled HTML tables instead of leaking raw pipes and dashes. Implemented with a stash-and-restore placeholder pass to keep the other transforms (paragraphs, lists, etc.) from chewing up the pipe characters. Plan review's batch submit was intentionally kept — its pieces are short briefs (~30s/each) where the "Submit Feedback" summary moment provides closure; the per-piece async pattern was overkill for that flow.

23. **Batch draft generation with server-side worker pool** (D38). Generating drafts for 27 ContentPieces one-by-one took 10–15 minutes of click-wait-click. Added a server-side batch flow that's resumable across tab closes: new endpoint `POST /api/content/drafts/batch` selects every `PLANNED` piece for a client that has no body yet, marks them all `WRITING` in a single `updateMany`, then kicks off a fire-and-forget worker pool with concurrency 3 (`void runBatch(pieceIds)` after the response is sent — Node keeps the promise alive on self-hosted Coolify). Each worker calls a new `generateContentBodyInternal()` helper extracted from `generateContentBody()` so it doesn't try to call `auth()` after the request-scoped session is gone. On per-piece failure the worker resets the piece back to `PLANNED`, so a subsequent batch click retries only the failures. The companion `GET /api/content/drafts/batch/status?clientId=…` returns `{ writing, pending, drafted }` counts. The Drafts tab adds a "Generate All Drafts (N)" button and an "in progress" banner; a polling effect hits the status endpoint every 3s while `isBatching` is true and refreshes the plan so completed pieces flip to "Draft Ready" in real time. The polling effect also runs once on mount so a user returning to a tab mid-batch picks up the in-flight state automatically.

---

## 10. How to start a new working session

1. Read this doc top-to-bottom.
2. Read [ROADMAP.md](../ROADMAP.md) for product-level context.
3. Check Coolify env vars are still aligned with Section 3.
4. `cd kngo-seo-platform && npm install && npx prisma generate && npm run dev` to run locally.
5. If picking up Path B: start with the `TopicCluster` schema design.
6. If something's broken: check the entrypoint logs in Coolify (`docker-entrypoint.sh` is verbose); migration state issues are the most likely root cause.

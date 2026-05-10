# KNGO SEO Platform — Product Roadmap

> **Last updated:** April 5, 2026
> **Owner:** Kango Media
> **Platform:** [seo.kangomedia.com](https://seo.kangomedia.com)

---

## ✅ Phase 1 — Foundation (Complete)

### Authentication & Multi-Tenancy
- [x] NextAuth credential-based login
- [x] Role-based access: `AGENCY_ADMIN`, `AGENCY_MEMBER`, `CLIENT`
- [x] Client access via unique token URLs (no login required)
- [x] Session management + sign-out

### Client Management
- [x] Add/remove clients
- [x] Client tiers (Starter, Growth, Authority)
- [x] Edit client info (business details, contact info)
- [x] Google Business Profile fields (name, URL, phone, address, category)
- [x] Monthly deliverable defaults per client

### Agency Dashboard
- [x] Client grid with status, tier, keyword counts
- [x] Quick-access navigation to client details

---

## ✅ Phase 2 — Rankings & Content Engine (Complete)

### Keyword Rank Tracking (DataForSEO)
- [x] Add/remove keywords per client
- [x] Auto-fetch search volume and difficulty on keyword add
- [x] Check Rankings — live SERP tracking via DataForSEO
- [x] Domain normalization for accurate position matching
- [x] Exponential-backoff polling for reliable results
- [x] Rank snapshots with position history and deltas
- [x] Refresh Metrics button for bulk volume/difficulty updates

### AI Content Engine (Claude)
- [x] Auto-generate content plans from tracked keywords
- [x] AI draft generation for blog posts, GBP posts
- [x] Content piece management (status workflow)
- [x] SEO content writing skill integration

### Content Approval Flow
- [x] "Send for Approval" batch action
- [x] Shareable client approval portal URL (copied to clipboard)
- [x] Client review interface with approve/reject per piece

### Reporting
- [x] Generate monthly reports with full data snapshots
- [x] Public report viewer via unique UUID
- [x] Report data frozen at time of generation

---

## 🔜 Phase 3 — On-Page SEO Audit & Optimization

> **Goal:** Provide Search Atlas "Auto"-level on-page analysis. Crawl client
> websites and generate actionable optimization task lists.

### Site Crawler (DataForSEO On-Page API)
- [x] POST client domain to DataForSEO On-Page API for full-site crawl
- [x] Store crawl results in database (per-page analysis)
- [x] Dashboard showing overall site health score
- [x] Per-page breakdown with issues categorized by severity

### On-Page Analysis Categories
- [x] **Meta Tags:** Missing/duplicate/too-long title tags and meta descriptions
- [x] **Headings:** H1 presence, H1 count, heading hierarchy issues
- [x] **Images:** Missing alt text, oversized images, no lazy loading
- [x] **Content:** Thin content detection, keyword density, readability
- [x] **Links:** Broken internal/external links, orphan pages, redirect chains
- [x] **Schema:** Missing structured data (LocalBusiness, FAQ, etc.)
- [x] **Technical:** Canonical issues, duplicate content, robots.txt problems
- [ ] **Core Web Vitals:** Page speed, CLS, LCP, FID proxies *(partial — loading time available, full CWV metrics not yet)*

### Optimization Task List
- [x] Auto-generated task list per page (AI-powered recommendations)
- [x] Priority scoring (Critical / Warning / Info)
- [x] Track completion status as tasks are resolved (OPEN / FIXED / IGNORED)
- [x] Re-crawl to verify fixes and update scores

### WordPress Integration (for WP clients) — *Deferred to Phase 7*

---

## ✅ Phase 4 — Google Analytics & Search Console Integration

> **Goal:** Connect real traffic and indexing data per client. Each client
> can have their own GA4 and GSC properties linked via the agency Google account.

### Google Search Console
- [x] OAuth2 connection flow (agency Google account)
- [x] Property selection per client (via client settings)
- [x] Pull search performance data (clicks, impressions, CTR, position)
- [ ] Pull indexing status and coverage issues
- [ ] URL inspection integration (check specific pages)
- [ ] Sitemaps management (submit/check status)

### Google Analytics 4
- [x] OAuth2 connection flow
- [x] GA4 property selection per client (via client settings)
- [x] Pull traffic overview (sessions, users, bounce rate)
- [x] Pull traffic by source/medium
- [x] Pull landing page performance
- [ ] Pull conversions/goals data
- [x] Traffic trend charts on client dashboard

### Dashboard Integration
- [ ] Merge GA4 + GSC data into client overview
- [ ] Enrich monthly reports with real traffic data
- [ ] Alert when traffic drops significantly
- [ ] Compare organic vs. paid vs. referral traffic

---

## 📋 Phase 5 — Schema & Technical SEO Tools

> **Goal:** Make it easy to generate and validate structured data for local
> SEO clients.

### Schema Markup Generator
- [ ] LocalBusiness schema generator (auto-fill from GBP data)
- [ ] FAQ schema from content
- [ ] Service schema
- [ ] Review/aggregate rating schema
- [ ] Schema validation against Google's requirements
- [ ] Copy-paste code snippets for client implementation

### Technical SEO Checks
- [ ] Robots.txt analyzer
- [ ] Sitemap.xml validator
- [ ] SSL/HTTPS check
- [ ] Mobile-friendliness assessment
- [ ] Page speed analysis with recommendations
- [ ] Canonical URL verification

---

## 📋 Phase 6 — Go High Level CRM Integration

> **Goal:** Sync client/contact data between the SEO platform and GHL.
> Leverage GHL's communication tools for client engagement.

### Contact Sync
- [ ] Map KNGO clients to GHL contacts/opportunities
- [ ] Auto-create GHL contacts when adding new SEO clients
- [ ] Sync contact info changes bi-directionally
- [ ] Tag GHL contacts with SEO tier and status

### Communication
- [ ] Send approval notifications via GHL workflows
- [ ] Trigger GHL automations on content status changes
- [ ] Monthly report delivery via GHL email

### Reporting
- [ ] Push SEO performance data to GHL custom fields
- [ ] Create GHL pipeline stages matching content workflow
- [ ] Sync deliverable completion status

---

## 📋 Phase 7 — Advanced Features & Scale

### Client Reports (New Client Deliverables)
- [ ] **Site Audit Report** — Exportable report summarizing all on-page issues, scores, and AI recommendations per page. Designed as the first deliverable for a brand-new client.
- [ ] **Baseline Report** — Combines site audit data with Google Analytics and Search Console metrics to establish a performance baseline before SEO work begins. Includes traffic, impressions, top queries, and technical health.
- [ ] Report PDF export / shareable link for both report types

### Email Notifications
- [ ] Automated email on "Send for Approval" (Resend or SendGrid)
- [ ] Weekly/monthly digest emails to clients
- [ ] Alert emails for significant ranking changes

### Press Releases
- [ ] Press release content type in content planner
- [ ] AI generation with press release formatting
- [ ] Distribution tracking

### Competitor Analysis
- [ ] Track competitor domains per client
- [ ] Compare rankings side-by-side
- [ ] Identify keyword gaps (competitor ranks, client doesn't)

### AI-Powered Keyword Research (High-Intent Focus)
> **Goal:** Differentiate from generic keyword tools by delivering only high-ROI,
> buying-intent keywords through an intelligent onboarding conversation.
- [ ] AI-powered client onboarding interview that captures:
  - Type of business and core services
  - Ideal client profile (demographics, pain points, budget level)
  - Service areas (cities, regions)
  - Business differentiators and competitive positioning
- [ ] Optional website scraping to pre-populate business context from client's existing site
- [ ] High-intent keyword filtering that prioritizes:
  - Buying-intent modifiers (e.g., "hire", "near me", "cost", "best")
  - Service-specific long-tail keywords
  - Location-modified keywords for local SEO
- [ ] Automatic filtering out of:
  - Low-intent/informational-only queries ("free", "DIY", "how to")
  - Irrelevant keywords that don't match the business profile
- [ ] AI-curated keyword suggestions with intent classification and ROI scoring

### White-Label
- [ ] Custom branding per agency
- [ ] Custom domain support for client portals
- [ ] Branded report templates
- [ ] Branded HTML email templates (incorporate agency logo and brand colors)

### Multi-Agency
- [ ] Support multiple agency accounts
- [ ] Per-agency billing/plans
- [ ] Agency-specific settings and branding

---

## 📋 Phase 9 — Strategic SEO Planning (beyond content)

> **Goal:** Expand from monthly content delivery (blogs, GBP, Q&As, press releases) into full-strategy execution: service pages, landing pages, technical SEO tasks, link-building checklists, on-page optimizations.
>
> **Why this is its own phase:** The AI strategic analysis already recommends things like "add a service page for X" or "rewrite the homepage hero." Today the platform can't act on those — they're advisory only. This phase makes them first-class deliverables.
>
> **Customer-facing distinction:** The current content-only package is what's sold to most clients. This phase opens an upsell tier ("Strategy + Build") for clients who want pages added/rewritten, not just monthly content.

### Phase 9a — New content types
- [ ] Schema: extend `ContentType` enum with `SERVICE_PAGE`, `LANDING_PAGE`, `HOMEPAGE_SECTION`, `ABOUT_PAGE`
- [ ] Per-type generation prompts (service pages aren't structured like blog posts — different headings, CTA placement, schema markup, internal linking patterns)
- [ ] Different review flow — service pages typically need 2-3 revision rounds vs blog one-shot
- [ ] WordPress publish: posts vs pages distinction respected at publish time

### Phase 9a-2 — Unified Strategic Plan (single source of truth)
> **Today:** Each `KeywordResearch` row carries its own AI strategic analysis. Clicking different research sessions surfaces different "action plans," which makes the platform feel like the master plan changes every time you research. **It shouldn't.**
- [ ] New `StrategicPlan` model OR `Client.strategicPlan` field — captures the unified, current action plan that pulls from ALL research sessions + the active content map
- [ ] "Regenerate plan" button on the Strategy tab — re-synthesizes from all data sources at once
- [ ] Per-research analyses get demoted to "Research Insights" (already done in UI as of D-current) — they describe what THAT run found, not what to do
- [ ] Plan history: when regenerated, the prior plan is archived (not lost) so you can compare strategic evolution over months
- [ ] Optional client-facing version of the plan in the read-only client portal

### Phase 9b — Strategic task tracker
- [ ] New `StrategicTask` model — captures recommendations from the AI analysis that aren't content (e.g. "add LocalBusiness schema", "build 3 backlinks from local newspapers", "fix slow LCP on /services page")
- [ ] Categories: technical, on-page, off-page, link-building, schema, conversion
- [ ] Status workflow: identified → scheduled → in_progress → completed → verified
- [ ] Surface on a "Strategic Tasks" tab — separate from content
- [ ] Auto-populate from the Strategic Analysis output (parse and propose tasks)

### Phase 9c — Page-level optimization workflow
- [ ] Per-URL view: existing copy, current rankings, suggested rewrites, schema gaps, internal linking gaps
- [ ] Generate optimized copy for an existing page (vs. generating a new page)
- [ ] Track before/after performance per URL once changes are published

### Phase 9d — Constrain analysis to package tier
- [ ] AI strategic analysis prompt accepts a `packageScope` param — `"content_only" | "content_plus_pages" | "full_strategy"`
- [ ] Recommendations outside scope are clearly tagged "stretch" so agency can have an upsell conversation rather than the client expecting them
- [ ] Per-client `packageTier` setting determines default scope for that client's analysis

### Phase 9e — Stretch
- [ ] Link-building outreach kanban (already partially in `guest_posts` but not wired)
- [ ] Press release distribution tracking
- [ ] Citations / directory submission tracker
- [ ] Conversion-rate optimization recommendations from heatmap data (would need 3rd-party integration)

---

## 📋 Phase 8 — AI Image Generation for Content

> **Goal:** Eliminate the manual round-trip of taking blog content to Gemini, getting featured images, and copying back filenames + alt text. Native image generation tied to each content piece, with a per-client brand-style guide for visual consistency.
>
> **Validated approach:** Operator already manually drives this with Gemini and gets good results — productize that flow.

### Phase 8a — Per-piece image generator (MVP)
- [ ] Schema: `MediaAsset` model (clientId, contentPieceId nullable, type, prompt, model, aspectRatio, fileName, altText, storageUrl, regenerationCount, createdAt)
- [ ] Schema: `Client.imageStyle` field — brand visual style guide prepended to every prompt for that client
- [ ] `src/lib/gemini.ts` wrapper for Imagen 3 via Google AI Studio API (same shape as `claude.ts`)
- [ ] Vultr S3 upload helper (bucket: `kngo-images`)
- [ ] `POST /api/clients/[id]/images/generate` — builds prompt from content piece context + brand style, calls Imagen, stores image, returns SEO filename + alt text
- [ ] Inline Images panel on the draft editor — Generate button, image preview, regenerate, save & insert
- [ ] Filename generation: kebab-case from target keyword + position
- [ ] Alt text generation: Claude reads piece context + image prompt to write SEO-friendly alt text
- [ ] WordPress integration: on publish, upload `MediaAsset` rows via WP Media API, set featured image, swap markdown placeholders

### Phase 8b — Library + brand consistency
- [ ] Client-level "Images" tab — browseable library of all generated assets, search/filter
- [ ] `Client.imageStyle` editable in Edit Client modal
- [ ] Multi-aspect-ratio support: hero (16:9), square (1:1), Pinterest (2:3), OG (1.91:1)
- [ ] Re-use existing library images on new pieces (click-insert from library)
- [ ] Re-prompt UX: "Refine prompt" button shows editable prompt before regenerating

### Phase 8c — Multi-image automation
- [ ] Auto-generate one section image per H2 from a published draft (batch)
- [ ] Quote-card generator from Claude-extracted pull quotes
- [ ] Social-format variants (1200×630 OG, 1000×1500 Pinterest) from a single source prompt
- [ ] Per-piece image checklist — "post needs hero + 3 section images + 1 social"

### Phase 8d — Stretch
- [ ] Image-understanding pass: send generated image back to Gemini/Claude to refine alt text from actual visual content (more accurate than alt-from-prompt)
- [ ] GBP post image automation (already-tracked `gbp_posts` content type → auto-generate accompanying image)
- [ ] Bulk regeneration when brand style changes (re-run all hero images for a client with the new style guide)
- [ ] Image performance tracking — which images correlate with higher CTR / time-on-page

**Estimated cost:** ~$0.04/image via Imagen 3. At 10 blogs × 3 images per client = $1.20/mo per client. Negligible.

**New env vars:** `GEMINI_API_KEY` (Google AI Studio).

---

## 🐛 Known Issues & Technical Debt

- [ ] Report frequency limiting (prevent generating multiple reports per month)
- [ ] Pagination on keyword and content lists
- [ ] Bulk keyword import (CSV upload)
- [ ] Better error handling/user feedback on API failures
- [ ] Rate limiting on DataForSEO calls (cost management)

---

## Architecture Notes

### Current Stack
- **Framework:** Next.js 16 (App Router)
- **Database:** PostgreSQL via Prisma
- **Auth:** NextAuth.js (credentials)
- **AI:** Claude (Anthropic) for content generation
- **SEO Data:** DataForSEO (rankings, search volume, on-page)
- **Hosting:** Coolify (Docker, self-hosted)

### API Credentials (Environment Variables)
| Service | Env Vars |
|---------|----------|
| DataForSEO | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` |
| Claude AI | `ANTHROPIC_API_KEY` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Phase 4) |
| GHL | `GHL_API_KEY` (Phase 6) |
| Email | `RESEND_API_KEY` or `SENDGRID_API_KEY` (Phase 7) |
| Image Generation | `GEMINI_API_KEY` (Phase 8) |

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

### WordPress Integration (for WP clients)
- [ ] Detect WordPress sites automatically
- [ ] Connect via WP REST API with Application Passwords
- [ ] Read page/post content directly from WP
- [ ] (Future) Push meta title/description updates directly to WP

---

## 📋 Phase 4 — Google Analytics & Search Console Integration

> **Goal:** Connect real traffic and indexing data per client. Each client
> can have their own GA4 and GSC properties linked.

### Google Search Console
- [ ] OAuth2 connection flow (agency Google account)
- [ ] Property selection per client
- [ ] Pull search performance data (clicks, impressions, CTR, position)
- [ ] Pull indexing status and coverage issues
- [ ] Pull Core Web Vitals data
- [ ] URL inspection integration (check specific pages)
- [ ] Sitemaps management (submit/check status)

### Google Analytics 4
- [ ] OAuth2 connection flow
- [ ] GA4 property selection per client
- [ ] Pull traffic overview (sessions, users, bounce rate)
- [ ] Pull traffic by source/medium
- [ ] Pull landing page performance
- [ ] Pull conversions/goals data
- [ ] Traffic trend charts on client dashboard

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

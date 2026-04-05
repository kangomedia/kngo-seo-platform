/**
 * Mock data for development — mirrors the Prisma schema structure
 * Replace with real database queries in production
 */

// ─── Clients ──────────────────────────────────────────

export const clients = [
  {
    id: "cl-mission-ac",
    name: "Mission AC & Heating",
    domain: "missionacheating.com",
    tier: "GROWTH" as const,
    logoUrl: null,
    monthlyBlogs: 4,
    monthlyGbpPosts: 8,
    monthlyPressReleases: 1,
    metrics: {
      keywordsTracked: 47,
      avgPosition: 14.2,
      avgPositionChange: -3.1,
      page1Keywords: 12,
      page1Change: 4,
      contentPublished: 6,
      healthScore: 78,
    },
  },
  {
    id: "cl-strong-contractors",
    name: "Strong Contractors",
    domain: "strongcontractors.com",
    tier: "PRO" as const,
    logoUrl: null,
    monthlyBlogs: 6,
    monthlyGbpPosts: 12,
    monthlyPressReleases: 1,
    metrics: {
      keywordsTracked: 89,
      avgPosition: 8.7,
      avgPositionChange: -5.4,
      page1Keywords: 34,
      page1Change: 7,
      contentPublished: 11,
      healthScore: 92,
    },
  },
  {
    id: "cl-eclypse-auto",
    name: "Eclypse Auto",
    domain: "eclypseauto.com",
    tier: "STARTER" as const,
    logoUrl: null,
    monthlyBlogs: 2,
    monthlyGbpPosts: 4,
    monthlyPressReleases: 0,
    metrics: {
      keywordsTracked: 23,
      avgPosition: 28.5,
      avgPositionChange: -1.8,
      page1Keywords: 5,
      page1Change: 2,
      contentPublished: 3,
      healthScore: 61,
    },
  },
  {
    id: "cl-lx-construction",
    name: "LX Construction",
    domain: "lxconstructionllc.com",
    tier: "STARTER" as const,
    logoUrl: null,
    monthlyBlogs: 2,
    monthlyGbpPosts: 4,
    monthlyPressReleases: 0,
    metrics: {
      keywordsTracked: 18,
      avgPosition: 35.2,
      avgPositionChange: -2.3,
      page1Keywords: 3,
      page1Change: 1,
      contentPublished: 2,
      healthScore: 45,
    },
  },
];

// ─── Keywords & Rankings ──────────────────────────────

export const keywordsByClient: Record<
  string,
  Array<{
    id: string;
    keyword: string;
    position: number | null;
    previousPos: number | null;
    change: number | null;
    searchVolume: number;
    difficulty: number;
    url: string;
    group: string;
  }>
> = {
  "cl-mission-ac": [
    { id: "kw-1", keyword: "ac repair denver", position: 4, previousPos: 8, change: 4, searchVolume: 2400, difficulty: 45, url: "/ac-repair", group: "AC Repair" },
    { id: "kw-2", keyword: "hvac company near me", position: 7, previousPos: 12, change: 5, searchVolume: 4800, difficulty: 52, url: "/", group: "General HVAC" },
    { id: "kw-3", keyword: "furnace repair denver", position: 3, previousPos: 5, change: 2, searchVolume: 1900, difficulty: 38, url: "/furnace-repair", group: "Heating" },
    { id: "kw-4", keyword: "emergency ac repair", position: 11, previousPos: 15, change: 4, searchVolume: 1200, difficulty: 41, url: "/emergency-ac", group: "AC Repair" },
    { id: "kw-5", keyword: "heating installation denver", position: 6, previousPos: 9, change: 3, searchVolume: 880, difficulty: 35, url: "/heating-installation", group: "Heating" },
    { id: "kw-6", keyword: "air conditioning service", position: 15, previousPos: 22, change: 7, searchVolume: 3200, difficulty: 55, url: "/ac-service", group: "AC Repair" },
    { id: "kw-7", keyword: "denver hvac contractor", position: 9, previousPos: 14, change: 5, searchVolume: 720, difficulty: 33, url: "/", group: "General HVAC" },
    { id: "kw-8", keyword: "ac installation cost denver", position: 18, previousPos: 25, change: 7, searchVolume: 590, difficulty: 29, url: "/ac-installation", group: "AC Repair" },
  ],
  "cl-strong-contractors": [
    { id: "kw-10", keyword: "general contractor denver", position: 2, previousPos: 3, change: 1, searchVolume: 5400, difficulty: 62, url: "/", group: "General" },
    { id: "kw-11", keyword: "home remodeling denver", position: 5, previousPos: 8, change: 3, searchVolume: 3100, difficulty: 55, url: "/remodeling", group: "Remodeling" },
    { id: "kw-12", keyword: "kitchen remodel denver", position: 4, previousPos: 6, change: 2, searchVolume: 2800, difficulty: 48, url: "/kitchen-remodel", group: "Remodeling" },
    { id: "kw-13", keyword: "basement finishing denver", position: 1, previousPos: 2, change: 1, searchVolume: 2100, difficulty: 42, url: "/basement-finishing", group: "Basements" },
    { id: "kw-14", keyword: "bathroom remodel contractor", position: 6, previousPos: 11, change: 5, searchVolume: 1900, difficulty: 44, url: "/bathroom-remodel", group: "Remodeling" },
  ],
};

// ─── Content Plans ────────────────────────────────────

export const contentPlansByClient: Record<
  string,
  {
    id: string;
    month: number;
    year: number;
    title: string;
    pieces: Array<{
      id: string;
      type: "BLOG_POST" | "GBP_POST" | "PRESS_RELEASE";
      title: string;
      description: string;
      keyword: string;
      status: string;
      approval?: { outcome: string; notes?: string };
    }>;
  }
> = {
  "cl-mission-ac": {
    id: "cp-1",
    month: 4,
    year: 2026,
    title: "April 2026 Content Plan",
    pieces: [
      { id: "piece-1", type: "BLOG_POST", title: "5 Signs Your AC Needs Repair Before Summer Hits", description: "Help homeowners identify common AC issues before the Denver summer heat arrives. Cover unusual noises, weak airflow, strange smells, short cycling, and rising energy bills.", keyword: "ac repair denver", status: "APPROVED", approval: { outcome: "approved" } },
      { id: "piece-2", type: "BLOG_POST", title: "Furnace vs. Heat Pump: Which Is Right for Denver Homes?", description: "Compare heating options for Colorado's climate. Discuss efficiency, cost, comfort, and environmental impact to help homeowners make informed decisions.", keyword: "furnace repair denver", status: "CLIENT_REVIEW" },
      { id: "piece-3", type: "BLOG_POST", title: "How to Choose the Right HVAC Contractor in Denver", description: "Guide covering licensing, insurance, reviews, estimates, and red flags when hiring an HVAC company. Position Mission AC as the trusted choice.", keyword: "hvac company near me", status: "WRITING", approval: { outcome: "approved" } },
      { id: "piece-4", type: "BLOG_POST", title: "The True Cost of AC Installation in Denver (2026 Guide)", description: "Transparent pricing guide covering unit costs, installation labor, ductwork, permits, and financing options. Build trust through transparency.", keyword: "ac installation cost denver", status: "PLANNED" },
      { id: "piece-5", type: "GBP_POST", title: "Spring AC Tune-Up Special — $89", description: "Promote the spring maintenance special with urgency. Include what's covered in the tune-up and why it matters before summer.", keyword: "ac service denver", status: "PUBLISHED" },
      { id: "piece-6", type: "GBP_POST", title: "Why Denver Homeowners Trust Mission AC", description: "Social proof post highlighting recent 5-star reviews and years of experience serving the Denver metro area.", keyword: "hvac company near me", status: "PUBLISHED" },
      { id: "piece-7", type: "GBP_POST", title: "Emergency AC Repair — Same Day Service Available", description: "Highlight 24/7 emergency availability. Reassure homeowners that help is a phone call away, even evenings and weekends.", keyword: "emergency ac repair", status: "APPROVED" },
      { id: "piece-8", type: "PRESS_RELEASE", title: "Mission AC & Heating Expands Service Area to Aurora and Lakewood", description: "Announce the expansion of service coverage. Include company background, leadership quotes, and what this means for new communities.", keyword: "hvac company denver", status: "PLANNED" },
    ],
  },
};

// ─── Deliverables ─────────────────────────────────────

export const deliverablesByClient: Record<
  string,
  Array<{
    id: string;
    name: string;
    targetCount: number;
    currentCount: number;
    status: string;
    month: number;
    year: number;
  }>
> = {
  "cl-mission-ac": [
    { id: "del-1", name: "Blog Posts", targetCount: 4, currentCount: 1, status: "IN_PROGRESS", month: 4, year: 2026 },
    { id: "del-2", name: "GBP Posts", targetCount: 8, currentCount: 3, status: "IN_PROGRESS", month: 4, year: 2026 },
    { id: "del-3", name: "Press Releases", targetCount: 1, currentCount: 0, status: "PENDING", month: 4, year: 2026 },
    { id: "del-4", name: "Monthly Report", targetCount: 1, currentCount: 0, status: "PENDING", month: 4, year: 2026 },
    { id: "del-5", name: "Rank Tracking", targetCount: 1, currentCount: 1, status: "COMPLETED", month: 4, year: 2026 },
    { id: "del-6", name: "Technical Audit Review", targetCount: 1, currentCount: 0, status: "PENDING", month: 4, year: 2026 },
  ],
  "cl-strong-contractors": [
    { id: "del-10", name: "Blog Posts", targetCount: 6, currentCount: 4, status: "IN_PROGRESS", month: 4, year: 2026 },
    { id: "del-11", name: "GBP Posts", targetCount: 12, currentCount: 9, status: "IN_PROGRESS", month: 4, year: 2026 },
    { id: "del-12", name: "Press Releases", targetCount: 1, currentCount: 1, status: "COMPLETED", month: 4, year: 2026 },
    { id: "del-13", name: "Monthly Report", targetCount: 1, currentCount: 1, status: "COMPLETED", month: 4, year: 2026 },
    { id: "del-14", name: "Rank Tracking", targetCount: 1, currentCount: 1, status: "COMPLETED", month: 4, year: 2026 },
  ],
};

// ─── Portfolio Stats ──────────────────────────────────

export function getPortfolioStats() {
  const totalKeywords = clients.reduce((sum, c) => sum + c.metrics.keywordsTracked, 0);
  const totalPage1 = clients.reduce((sum, c) => sum + c.metrics.page1Keywords, 0);
  const totalContent = clients.reduce((sum, c) => sum + c.metrics.contentPublished, 0);
  const avgHealth = Math.round(clients.reduce((sum, c) => sum + c.metrics.healthScore, 0) / clients.length);

  return { totalKeywords, totalPage1, totalContent, avgHealth, clientCount: clients.length };
}

// ─── Ranking Trend Data (for charts) ──────────────────

export function getRankingTrend(clientId: string) {
  // Simulated 30-day trend
  const basePositions: Record<string, number> = {
    "cl-mission-ac": 18,
    "cl-strong-contractors": 12,
    "cl-eclypse-auto": 32,
    "cl-lx-construction": 38,
  };

  const base = basePositions[clientId] || 25;
  const days = 30;
  const trend = [];

  for (let i = 0; i < days; i++) {
    const noise = Math.sin(i * 0.3) * 2 + Math.random() * 1.5;
    const improvement = (i / days) * 4;
    trend.push({
      date: new Date(2026, 2, 7 + i).toISOString().split("T")[0],
      avgPosition: Math.max(1, Math.round((base - improvement + noise) * 10) / 10),
      page1Count: Math.round(base / 3 + improvement * 1.2 + Math.random() * 2),
    });
  }

  return trend;
}

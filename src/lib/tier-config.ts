// Tier display labels and default deliverable counts
// Maps internal enum values to official KangoMedia plan names

export const TIER_LABELS: Record<string, string> = {
  STARTER: "Local Visibility",
  GROWTH: "Growth SEO",
  PRO: "Authority SEO",
};

export const TIER_PRICES: Record<string, number> = {
  STARTER: 400,
  GROWTH: 800,
  PRO: 1500,
};

export const TIER_COLORS: Record<string, string> = {
  STARTER: "tier-starter",
  GROWTH: "tier-growth",
  PRO: "tier-pro",
};

// Default deliverable counts per tier (matches pricing document)
export const TIER_DEFAULTS: Record<string, {
  monthlyBlogs: number;
  monthlyGbpPosts: number;
  monthlyGbpQAs: number;
  monthlyPressReleases: number;
  monthlyDirectoryListings: number;
}> = {
  STARTER: {
    monthlyBlogs: 2,
    monthlyGbpPosts: 2,
    monthlyGbpQAs: 2,
    monthlyPressReleases: 1,
    monthlyDirectoryListings: 25,
  },
  GROWTH: {
    monthlyBlogs: 4,
    monthlyGbpPosts: 4,
    monthlyGbpQAs: 4,
    monthlyPressReleases: 1,
    monthlyDirectoryListings: 50,
  },
  PRO: {
    monthlyBlogs: 10,
    monthlyGbpPosts: 8,
    monthlyGbpQAs: 8,
    monthlyPressReleases: 1,
    monthlyDirectoryListings: 100,
  },
};

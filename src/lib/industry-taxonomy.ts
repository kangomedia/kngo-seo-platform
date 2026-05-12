/**
 * industry-taxonomy.ts
 *
 * Two-tier industry taxonomy: Sector → Vertical.
 * - Sector (~13 broad buckets) drives the AI prompting context.
 * - Vertical (~200 specific industries) drives display/labeling.
 *
 * Vertical names are seeded from Google Business Profile categories
 * where possible so they match what clients pick for their GBP listings.
 */

// ─── Types ───────────────────────────────────────────────

export interface Sector {
  id: string;         // kebab-case slug, e.g. "home-services"
  label: string;      // Display name, e.g. "Home Services & Trades"
  verticals: string[];
}

// ─── Taxonomy Data ───────────────────────────────────────

export const SECTORS: Sector[] = [
  {
    id: "home-services",
    label: "Home Services & Trades",
    verticals: [
      "General Contractor",
      "Home Remodeler",
      "Kitchen Remodeler",
      "Bathroom Remodeler",
      "HVAC Contractor",
      "Plumber",
      "Electrician",
      "Roofer",
      "Painter",
      "Flooring Contractor",
      "Landscaper",
      "Lawn Care Service",
      "Tree Service",
      "Pest Control Service",
      "Pool Service",
      "Fence Contractor",
      "Garage Door Supplier",
      "Window Installer",
      "Siding Contractor",
      "Concrete Contractor",
      "Masonry Contractor",
      "Foundation Repair",
      "Waterproofing Company",
      "Insulation Contractor",
      "Solar Energy Company",
      "Septic System Service",
      "Well Drilling Contractor",
      "Excavating Contractor",
      "Demolition Contractor",
      "Paving Contractor",
      "Deck Builder",
      "Cabinet Maker",
      "Countertop Installer",
      "Handyman",
      "Locksmith",
      "Appliance Repair Service",
      "Cleaning Service",
      "Carpet Cleaning Service",
      "Pressure Washing Service",
      "Junk Removal Service",
      "Moving Company",
      "Fire & Water Restoration",
    ],
  },
  {
    id: "health-medical",
    label: "Health & Medical",
    verticals: [
      "General Dentist",
      "Cosmetic Dentist",
      "Orthodontist",
      "Oral Surgeon",
      "Pediatric Dentist",
      "Dental Implant Provider",
      "Chiropractor",
      "Physical Therapist",
      "Dermatologist",
      "Optometrist",
      "Ophthalmologist",
      "Podiatrist",
      "Orthopedic Surgeon",
      "Urgent Care Center",
      "Family Medicine",
      "Internal Medicine",
      "Pediatrician",
      "OB/GYN",
      "Cardiologist",
      "Psychiatrist",
      "Psychologist / Therapist",
      "Med Spa",
      "Plastic Surgeon",
      "Pain Management",
      "Hearing Aid Provider",
      "Home Health Care",
      "Veterinarian",
      "Pharmacy",
      "Acupuncturist",
      "Speech Therapist",
      "Occupational Therapist",
      "Addiction Treatment Center",
    ],
  },
  {
    id: "legal",
    label: "Legal",
    verticals: [
      "Personal Injury Attorney",
      "Family Law Attorney",
      "Criminal Defense Attorney",
      "Immigration Attorney",
      "Bankruptcy Attorney",
      "Estate Planning Attorney",
      "Employment Attorney",
      "Business / Corporate Attorney",
      "Real Estate Attorney",
      "Tax Attorney",
      "DUI Attorney",
      "Workers' Compensation Attorney",
      "Intellectual Property Attorney",
      "General Practice Attorney",
    ],
  },
  {
    id: "financial-professional",
    label: "Financial & Professional Services",
    verticals: [
      "CPA / Accounting Firm",
      "Bookkeeper",
      "Tax Preparation Service",
      "Financial Advisor",
      "Insurance Agency",
      "Mortgage Broker",
      "Business Consultant",
      "HR / Staffing Agency",
      "IT Services / MSP",
      "Marketing Agency",
      "Web Design / Development Agency",
      "Graphic Design Studio",
      "Video Production Company",
      "Translation / Interpreting Service",
    ],
  },
  {
    id: "real-estate",
    label: "Real Estate & Property",
    verticals: [
      "Real Estate Agent",
      "Property Management Company",
      "Real Estate Developer",
      "Commercial Real Estate Broker",
      "Mortgage Lender",
      "Title Company",
      "Home Inspector",
      "Appraiser",
      "Real Estate Photographer",
      "Storage Facility",
    ],
  },
  {
    id: "personal-care",
    label: "Personal Care & Wellness",
    verticals: [
      "Hair Salon",
      "Barbershop",
      "Nail Salon",
      "Day Spa",
      "Massage Therapist",
      "Personal Trainer",
      "Gym / Fitness Center",
      "Yoga Studio",
      "Pilates Studio",
      "Martial Arts School",
      "Weight Loss Service",
      "Tattoo Shop",
      "Esthetician",
      "Lash & Brow Studio",
    ],
  },
  {
    id: "automotive",
    label: "Automotive",
    verticals: [
      "Auto Repair Shop",
      "Auto Body Shop",
      "Tire Shop",
      "Car Dealership",
      "Used Car Dealer",
      "Auto Detailing Service",
      "Towing Service",
      "Transmission Repair",
      "Auto Glass Repair",
      "Car Wash",
    ],
  },
  {
    id: "food-hospitality",
    label: "Food & Hospitality",
    verticals: [
      "Restaurant",
      "Catering Service",
      "Bakery",
      "Food Truck",
      "Coffee Shop",
      "Bar / Nightclub",
      "Hotel / Motel",
      "Bed & Breakfast",
      "Event Venue",
      "Wedding Venue",
      "Party / Event Planner",
      "DJ / Entertainment Service",
    ],
  },
  {
    id: "retail-ecommerce",
    label: "Retail & E-commerce",
    verticals: [
      "Clothing Store",
      "Jewelry Store",
      "Furniture Store",
      "Pet Store",
      "Florist",
      "Gift Shop",
      "Liquor Store",
      "Smoke Shop / Vape Shop",
      "Electronics Store",
      "E-commerce Store",
    ],
  },
  {
    id: "b2b-services",
    label: "B2B Services",
    verticals: [
      "Commercial Cleaning",
      "Commercial HVAC",
      "Commercial Roofing",
      "Janitorial Service",
      "Waste Management",
      "Commercial Landscaping",
      "Security Guard Service",
      "Commercial Pest Control",
      "Printing / Sign Company",
      "Industrial Equipment Supplier",
      "Freight / Logistics",
      "SaaS / Software Company",
    ],
  },
  {
    id: "education-training",
    label: "Education & Training",
    verticals: [
      "Private School / Academy",
      "Tutoring Service",
      "Driving School",
      "Music School",
      "Dance Studio",
      "Preschool / Daycare",
      "Language School",
      "Trade School",
    ],
  },
  {
    id: "nonprofit",
    label: "Nonprofit",
    verticals: [
      "Charitable Organization",
      "Church / Religious Organization",
      "Community Organization",
      "Animal Rescue / Shelter",
    ],
  },
  {
    id: "other",
    label: "Other",
    verticals: [],
  },
];

// ─── Lookup Helpers ──────────────────────────────────────

/** Build a vertical → sector label map (cached on first call). */
let _verticalToSectorCache: Map<string, string> | null = null;

function getVerticalToSectorMap(): Map<string, string> {
  if (_verticalToSectorCache) return _verticalToSectorCache;
  const m = new Map<string, string>();
  for (const sector of SECTORS) {
    for (const v of sector.verticals) {
      m.set(v.toLowerCase(), sector.label);
    }
  }
  _verticalToSectorCache = m;
  return m;
}

/**
 * Given a vertical name, return the parent sector label.
 * Case-insensitive. Returns "Other" if not found.
 */
export function getSectorForVertical(vertical: string): string {
  if (!vertical) return "Other";
  const map = getVerticalToSectorMap();
  return map.get(vertical.toLowerCase()) ?? "Other";
}

/**
 * Get the Sector object by its id slug.
 */
export function getSectorById(id: string): Sector | undefined {
  return SECTORS.find((s) => s.id === id);
}

/**
 * Get all verticals across all sectors as a flat array.
 */
export function getAllVerticals(): string[] {
  return SECTORS.flatMap((s) => s.verticals);
}

/**
 * Get the verticals for a specific sector id.
 */
export function getVerticalsForSector(sectorId: string): string[] {
  return getSectorById(sectorId)?.verticals ?? [];
}

// ─── Legacy Migration Mapping ────────────────────────────

/**
 * Maps the old flat INDUSTRY_CATEGORIES / INDUSTRY_OPTIONS values
 * to { sector, vertical } pairs. Used by:
 *   1. The DB migration script (SQL UPDATE)
 *   2. The edit-client UI (auto-detect sector from legacy value)
 *
 * Values not in this map retain their original industryVertical text
 * and get industrySector = "Other" for manual review.
 */
export const LEGACY_MAPPING: Record<string, { sector: string; vertical: string }> = {
  // Home Services & Trades
  "Plumbing":           { sector: "Home Services & Trades", vertical: "Plumber" },
  "HVAC":               { sector: "Home Services & Trades", vertical: "HVAC Contractor" },
  "Electrical":         { sector: "Home Services & Trades", vertical: "Electrician" },
  "Roofing":            { sector: "Home Services & Trades", vertical: "Roofer" },
  "General Contractor": { sector: "Home Services & Trades", vertical: "General Contractor" },
  "Landscaping":        { sector: "Home Services & Trades", vertical: "Landscaper" },
  "Pest Control":       { sector: "Home Services & Trades", vertical: "Pest Control Service" },
  "Home Services":      { sector: "Home Services & Trades", vertical: "Home Remodeler" },
  "Cleaning Services":  { sector: "Home Services & Trades", vertical: "Cleaning Service" },
  "Moving Company":     { sector: "Home Services & Trades", vertical: "Moving Company" },
  "Construction":       { sector: "Home Services & Trades", vertical: "General Contractor" },

  // Health & Medical
  "Medical":            { sector: "Health & Medical", vertical: "Family Medicine" },
  "Dental":             { sector: "Health & Medical", vertical: "General Dentist" },

  // Legal
  "Legal":              { sector: "Legal", vertical: "General Practice Attorney" },

  // Financial & Professional Services
  "Accounting / CPA":   { sector: "Financial & Professional Services", vertical: "CPA / Accounting Firm" },
  "Accounting":         { sector: "Financial & Professional Services", vertical: "CPA / Accounting Firm" },
  "Insurance":          { sector: "Financial & Professional Services", vertical: "Insurance Agency" },
  "Financial Services": { sector: "Financial & Professional Services", vertical: "Financial Advisor" },
  "Professional Services": { sector: "Financial & Professional Services", vertical: "Business Consultant" },
  "Web Development":    { sector: "Financial & Professional Services", vertical: "Web Design / Development Agency" },
  "Marketing / Advertising": { sector: "Financial & Professional Services", vertical: "Marketing Agency" },
  "Technology / SaaS":  { sector: "B2B Services", vertical: "SaaS / Software Company" },
  "CAD / Engineering":  { sector: "Financial & Professional Services", vertical: "Business Consultant" },
  "Architecture":       { sector: "Financial & Professional Services", vertical: "Business Consultant" },

  // Real Estate & Property
  "Real Estate":        { sector: "Real Estate & Property", vertical: "Real Estate Agent" },

  // Personal Care & Wellness
  "Salon / Barber":     { sector: "Personal Care & Wellness", vertical: "Hair Salon" },
  "Fitness":            { sector: "Personal Care & Wellness", vertical: "Gym / Fitness Center" },

  // Automotive
  "Auto Repair":        { sector: "Automotive", vertical: "Auto Repair Shop" },
  "Automotive":         { sector: "Automotive", vertical: "Auto Repair Shop" },

  // Food & Hospitality
  "Restaurant":         { sector: "Food & Hospitality", vertical: "Restaurant" },

  // Retail & E-commerce
  "E-commerce":         { sector: "Retail & E-commerce", vertical: "E-commerce Store" },

  // Education & Training
  "Education / Training": { sector: "Education & Training", vertical: "Trade School" },
};

/**
 * Resolve a legacy industryVertical value to a { sector, vertical } pair.
 * If the value is already a known vertical in the taxonomy, returns its sector.
 * If it's a legacy label, maps it. Otherwise returns sector "Other" + the original text.
 */
export function resolveLegacyIndustry(
  legacyValue: string | null | undefined,
): { sector: string; vertical: string } {
  if (!legacyValue) return { sector: "", vertical: "" };

  // Check if it's already a valid vertical in the new taxonomy
  const sectorFromTaxonomy = getSectorForVertical(legacyValue);
  if (sectorFromTaxonomy !== "Other") {
    return { sector: sectorFromTaxonomy, vertical: legacyValue };
  }

  // Check legacy mapping
  const mapped = LEGACY_MAPPING[legacyValue];
  if (mapped) return mapped;

  // Fallback: keep the original text, flag as Other
  return { sector: "Other", vertical: legacyValue };
}

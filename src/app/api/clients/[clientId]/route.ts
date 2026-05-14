import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validateBody } from "@/lib/validate";

export const dynamic = "force-dynamic";

/**
 * The editable surface of a Client — the full set of fields any update path
 * is allowed to write. PUT and PATCH both validate against `.partial()` of
 * this schema so:
 *   - There's one source of truth for field shape + types.
 *   - PATCH can't drift away from PUT as new fields are added.
 *   - Unknown / stale field names (`brandTerm` instead of `brandTerms`) get
 *     dropped at the boundary instead of silently lost three modules later.
 *
 * JSON-column fields (serviceAreas, targetCities, brandTerms, …) come in as
 * NATIVE ARRAYS, not pre-encoded strings. They're encoded for storage at the
 * write site. The audit-flagged failure mode (`brandTerms: "foo"` getting
 * stored as the literal JSON string `"foo"`) is now a 400 at the boundary.
 */
const ClientEditableSchema = z.object({
  name: z.string().trim().min(1),
  domain: z.string().trim().nullable(),
  logoUrl: z.string().trim().nullable(),
  tier: z.enum(["STARTER", "GROWTH", "PRO"]),
  isActive: z.boolean(),

  // Contact
  contactName: z.string().trim().nullable(),
  // contactEmail allows null OR a valid email OR empty string (UI forms send
  // "" rather than omitting the field when cleared).
  contactEmail: z.union([z.string().email(), z.literal("")]).nullable(),
  contactPhone: z.string().trim().nullable(),
  address: z.string().trim().nullable(),
  city: z.string().trim().nullable(),
  state: z.string().trim().nullable(),
  zip: z.string().trim().nullable(),
  notes: z.string().nullable(),

  // GBP profile
  gbpName: z.string().trim().nullable(),
  gbpUrl: z.string().trim().nullable(),
  gbpPhone: z.string().trim().nullable(),
  gbpAddress: z.string().trim().nullable(),
  gbpCategory: z.string().trim().nullable(),

  // Monthly cadence
  monthlyBlogs: z.number().int().min(0),
  monthlyGbpPosts: z.number().int().min(0),
  monthlyGbpQAs: z.number().int().min(0),
  monthlyPressReleases: z.number().int().min(0),
  monthlyDirectoryListings: z.number().int().min(0),
  includesAudit: z.boolean(),
  includesReporting: z.boolean(),

  // Integrations
  gscProperty: z.string().trim().nullable(),
  ga4PropertyId: z.string().trim().nullable(),
  sitemapUrl: z.string().trim().nullable(),

  // Business profile (drives AI keyword targeting)
  businessDescription: z.string().nullable(),
  idealClientProfile: z.string().nullable(),
  priceRange: z.enum(["budget", "mid-range", "premium", "enterprise"]).nullable(),
  industryVertical: z.string().trim().nullable(),
  industrySector: z.string().trim().nullable(),

  // JSON-column arrays — see comment on schema above
  primaryServices: z.array(z.string().trim().min(1)),
  serviceAreas: z.array(z.string().trim().min(1)),
  targetCities: z.array(z.string().trim().min(1)),
  icpPains: z.array(z.string().trim().min(1)),
  competitors: z.array(z.string().trim().min(1)),
  brandTerms: z.array(z.string().trim().min(1)),

  // ROI tuning
  avgCpcUsd: z.number().min(0),
});

/** PUT + PATCH share the same `.partial()` shape — see ClientEditableSchema. */
const ClientUpdateSchema = ClientEditableSchema.partial();
type ClientUpdateBody = z.infer<typeof ClientUpdateSchema>;

/** Fields that need JSON.stringify on write because they back string columns. */
const JSON_COLUMN_FIELDS = [
  "primaryServices",
  "serviceAreas",
  "targetCities",
  "icpPains",
  "competitors",
  "brandTerms",
] as const;

const JSON_COLUMN_SET: Set<string> = new Set(JSON_COLUMN_FIELDS);

/**
 * Build a Prisma `data` object from a validated update body. Array fields
 * get JSON-encoded for storage; null/undefined empty arrays become null.
 */
function buildUpdateData(body: ClientUpdateBody): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (JSON_COLUMN_SET.has(key)) {
      const arr = value as string[];
      data[key] = arr.length > 0 ? JSON.stringify(arr) : null;
    } else if (key === "contactEmail" && value === "") {
      // Form sends "" when the operator clears the email; persist as null.
      data[key] = null;
    } else {
      data[key] = value;
    }
  }
  return data;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      keywords: {
        where: { isTracking: true },
        include: {
          snapshots: {
            orderBy: { checkedAt: "desc" },
            take: 2, // current + previous
          },
        },
      },
      contentPlans: {
        orderBy: [{ year: "desc" }, { month: "desc" }],
        include: {
          pieces: {
            orderBy: { sortOrder: "asc" },
            include: {
              approval: true,
              // Annotations let the agency see exactly which sentences the
              // client highlighted and what they wrote on each. Loaded
              // alongside approval so the Drafts tab can show inline feedback
              // without an extra fetch.
              annotations: {
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      },
      deliverables: {
        orderBy: [{ year: "desc" }, { month: "desc" }, { name: "asc" }],
      },
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(client);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validated = await validateBody(request, ClientUpdateSchema);
  if (validated instanceof NextResponse) return validated;

  const data = buildUpdateData(validated);
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { clientId } = await params;
  const updated = await prisma.client.update({
    where: { id: clientId },
    data,
  });

  return NextResponse.json(updated);
}

// ─── Soft Delete (Archive) — also accepts any partial edit ──────────────────
//
// PATCH historically existed only for `{ isActive: false }` archive/restore,
// but it shares the same validated update surface as PUT now. Today's UI only
// uses the archive/restore flow; future partial edits via PATCH will Just Work
// because the schema is shared.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validated = await validateBody(request, ClientUpdateSchema);
  if (validated instanceof NextResponse) return validated;

  const data = buildUpdateData(validated);
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { clientId } = await params;
  const updated = await prisma.client.update({
    where: { id: clientId },
    data,
  });

  return NextResponse.json(updated);
}

// ─── Permanent Delete ───────────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "AGENCY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  // Verify client exists before deleting
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Cascade delete handles all related data (keywords, snapshots, content plans, etc.)
  await prisma.client.delete({ where: { id: clientId } });

  return NextResponse.json({ success: true, deleted: client.name });
}

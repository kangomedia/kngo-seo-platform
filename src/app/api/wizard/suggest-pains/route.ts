// POST /api/wizard/suggest-pains
//
// Generates 12–15 candidate ICP pain points specific to the supplied
// business profile. Used by the onboarding wizard (and the Edit Client
// flow) so the operator can click-to-add pain candidates rather than
// inventing them from scratch.
//
// Body: {
//   businessDescription?: string
//   idealClientProfile?: string
//   industryVertical?: string
//   primaryServices?: string[]
// }
//
// Returns: { pains: string[] }

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateNarrative } from "@/lib/claude";

interface SuggestPayload {
  businessDescription?: string;
  idealClientProfile?: string;
  industryVertical?: string;
  primaryServices?: string[];
}

export async function POST(request: Request) {
  const session = await auth();
  if (
    !session ||
    (session.user.role !== "AGENCY_ADMIN" && session.user.role !== "AGENCY_MEMBER")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: SuggestPayload = await request.json().catch(() => ({}));
  const {
    businessDescription,
    idealClientProfile,
    industryVertical,
    primaryServices = [],
  } = body;

  // Need at least *some* signal to generate against. Industry vertical alone
  // is enough; otherwise require a description.
  if (!industryVertical && !businessDescription && primaryServices.length === 0) {
    return NextResponse.json(
      {
        error:
          "Need at least industryVertical, businessDescription, or primaryServices to suggest pains",
      },
      { status: 400 }
    );
  }

  const profileLines = [
    industryVertical ? `- Industry: ${industryVertical}` : null,
    businessDescription ? `- What they do: ${businessDescription}` : null,
    primaryServices.length > 0
      ? `- Services: ${primaryServices.join(", ")}`
      : null,
    idealClientProfile ? `- Ideal customer: ${idealClientProfile}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are a customer-discovery interviewer who specializes in extracting the *real* pain points an ideal customer feels — phrased in their own words, not in industry/marketing language.

Your output drives keyword research for top-of-funnel content. The pain phrases need to be specific enough that they map to real Google queries, but emotionally honest — what the person is actually frustrated by, not the abstract category.

RULES:
1. Output 12–15 pains, no more no less
2. Each pain is a short noun phrase (5–12 words). NOT a complete sentence. NOT a question.
3. Phrase them in the customer's voice — "homeowner with a leaking pipe at 11pm" not "after-hours emergency dispatch needs"
4. Cover a spread: scheduling/timing, money/transparency, trust/qualifications, communication/follow-up, urgency, outcome quality, and pain that's specific to the named industry
5. Avoid generic SaaS-flavored phrases unless the business actually sells SaaS — for a plumber, "missed call text back" is a vendor's framing; the customer's framing is "couldn't reach a plumber after hours"
6. Tailor strongly to the supplied business profile — a personal injury attorney's pains look completely different from an HVAC company's

Return ONLY a valid JSON array of 12–15 strings. No surrounding text, no code fences, no markdown.

Example shape (do NOT copy these — generate fresh ones for the supplied profile):
["pain phrase one", "pain phrase two", ...]`;

  const userMessage = `Business profile:
${profileLines}

Generate 12–15 ICP pain points specific to this business's customers.`;

  let raw: string;
  try {
    raw = await generateNarrative({
      systemPrompt,
      userMessage,
    });
  } catch (err) {
    console.error("[suggest-pains] Claude error:", err);
    return NextResponse.json(
      { error: "AI generation failed" },
      { status: 502 }
    );
  }

  // Parse the JSON array (Claude sometimes wraps in fences despite the rule)
  let pains: string[] = [];
  try {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Not an array");
    pains = parsed
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .map((p) => p.trim())
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .slice(0, 15);
  } catch (err) {
    console.error("[suggest-pains] JSON parse error:", err, raw);
    return NextResponse.json(
      { error: "AI returned malformed JSON" },
      { status: 502 }
    );
  }

  return NextResponse.json({ pains });
}

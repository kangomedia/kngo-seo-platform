"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { TIER_LABELS, TIER_DEFAULTS } from "@/lib/tier-config";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  ListChecks,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Settings2,
  Save,
  X,
  Globe,
  MapPin,
  Phone,
  Mail,
  Building2,
  Archive,
  Trash2,
  AlertTriangle,
  Microscope,
  Zap,
  Sparkles,
  Search,
  Plus,
  ArrowRight,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

interface ClientDetail {
  id: string;
  name: string;
  domain: string | null;
  tier: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  notes: string | null;
  gbpName: string | null;
  gbpUrl: string | null;
  gbpPhone: string | null;
  gbpAddress: string | null;
  gbpCategory: string | null;
  gscProperty: string | null;
  ga4PropertyId: string | null;
  sitemapUrl: string | null;
  monthlyBlogs: number;
  monthlyGbpPosts: number;
  monthlyGbpQAs: number;
  monthlyPressReleases: number;
  monthlyDirectoryListings: number;
  onboardingStatus: string | null;
  businessDescription: string | null;
  primaryServices: string | null;
  idealClientProfile: string | null;
  priceRange: string | null;
  industryVertical: string | null;
  serviceAreas: string | null;
  targetCities: string | null;
  icpPains: string | null;
  brandTerms: string | null;
  avgCpcUsd: number;
  keywords: Array<{
    id: string;
    keyword: string;
    searchVolume: number;
    difficulty: number;
    group: string;
    snapshots: Array<{
      position: number | null;
      previousPos: number | null;
      checkedAt: string;
    }>;
  }>;
  contentPlans: Array<{
    id: string;
    month: number;
    year: number;
    title: string;
    pieces: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      keyword: string;
      status: string;
      approval: { outcome: string; notes?: string } | null;
    }>;
  }>;
  deliverables: Array<{
    id: string;
    name: string;
    targetCount: number;
    currentCount: number;
    status: string;
    month: number;
    year: number;
  }>;
}

// Helpers for JSON-array TEXT fields edited as comma-separated strings.
// Bug we're fixing: round-tripping JSON↔display on every keystroke ran
// `filter(Boolean)` and stripped any in-progress trailing comma/space.
// Now we keep them as raw strings during edit and only stringify on save.
function jsonArrayToCommaString(stored: string | null | undefined): string {
  if (!stored) return "";
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed.filter((s) => typeof s === "string").join(", ");
    }
  } catch {
    // Legacy rows where the column might hold a non-JSON string
    return String(stored);
  }
  return "";
}

function commaStringToJsonArray(value: string): string {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return JSON.stringify(items);
}

// Industry vertical select with a custom-typing escape hatch. The control
// keeps its own `mode` state so that picking "Other" doesn't immediately
// clear the saved value and snap back to the default — the original bug
// was that we cleared `industryVertical` to "" when the operator picked
// Other, which then made the `isCustom` detection fail on the next render
// and the typing input disappeared.
const INDUSTRY_OPTIONS = [
  "Construction", "General Contractor", "HVAC", "Plumbing", "Electrical",
  "Roofing", "Landscaping", "Pest Control", "Home Services", "Cleaning Services",
  "Auto Repair", "Automotive",
  "Medical", "Dental", "Legal",
  "Real Estate", "Insurance", "Financial Services", "Accounting",
  "Restaurant", "Fitness",
  "Web Development", "Marketing / Advertising", "Technology / SaaS",
  "CAD / Engineering", "Architecture",
  "E-commerce", "Professional Services", "Education / Training",
] as const;

function IndustryVerticalSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  // The dropdown shows one of:
  //   - "" (placeholder)
  //   - a preset value
  //   - "__other__" (typing mode)
  // We derive the initial mode from the saved value: anything not in the
  // preset list AND non-empty means the operator typed a custom value
  // previously, so we start in typing mode.
  const isPreset = INDUSTRY_OPTIONS.includes(value as typeof INDUSTRY_OPTIONS[number]);
  const startInOther = !!value && !isPreset;
  const [mode, setMode] = useState<"preset" | "other">(startInOther ? "other" : "preset");

  // Sync mode if the parent value changes externally (e.g. cancel + reopen).
  useEffect(() => {
    const next = !!value && !INDUSTRY_OPTIONS.includes(value as typeof INDUSTRY_OPTIONS[number]);
    setMode(next ? "other" : "preset");
  }, [value]);

  const selectValue = mode === "other" ? "__other__" : value;

  return (
    <>
      <select
        className="input-field"
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "__other__") {
            // Switch to typing mode but PRESERVE whatever the operator
            // had typed before (if they previously had a custom value).
            // If they picked Other for the first time, value is "" and
            // the input renders empty + autofocused.
            setMode("other");
          } else {
            setMode("preset");
            onChange(next);
          }
        }}
      >
        <option value="">Select industry...</option>
        {INDUSTRY_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
        <option value="__other__">Other (type below)</option>
      </select>
      {mode === "other" && (
        <input
          className="input-field mt-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type your industry..."
          autoFocus
        />
      )}
    </>
  );
}

function MiniStat({
  label,
  value,
  change,
  positive,
}: {
  label: string;
  value: string | number;
  change?: string;
  positive?: boolean;
}) {
  return (
    <div className="stat-card">
      <p
        className="text-xs font-bold uppercase tracking-wide mb-2"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-extrabold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </p>
      {change && (
        <p
          className="text-xs font-bold mt-1 flex items-center gap-1"
          style={{
            color: positive ? "var(--success)" : "var(--danger)",
          }}
        >
          {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change}
        </p>
      )}
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  type?: string;
}) {
  return (
    <div>
      <label
        className="text-xs font-bold uppercase tracking-wide mb-1.5 block"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          >
            {icon}
          </span>
        )}
        <input
          className="input-field"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={icon ? { paddingLeft: 36 } : undefined}
        />
      </div>
    </div>
  );
}

// ─── Onboarding Progress Tracker ─────────────────────────

function OnboardingTracker({
  clientId,
  clientName,
  domain,
  status,
}: {
  clientId: string;
  clientName: string;
  domain: string | null;
  status: string;
}) {
  const [discoveryData, setDiscoveryData] = useState<{
    onboardingStatus: string;
    latestAudit: { id: string; status: string; taskId: string } | null;
    latestResearch: {
      id: string;
      results: string;
      aiAnalysis: string | null;
      keywordsFound: number;
    } | null;
  } | null>(null);
  const [polling, setPolling] = useState(status === "DISCOVERING");
  const [suggestedKeywords, setSuggestedKeywords] = useState<
    Array<{ keyword: string; searchVolume: number; competition: number; cpc: number }>
  >([]);
  const [trackedKeywords, setTrackedKeywords] = useState<Set<string>>(new Set());
  const [trackingInProgress, setTrackingInProgress] = useState<Set<string>>(new Set());
  const [trackingAll, setTrackingAll] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`discovery-dismissed-${clientId}`) === "true";
    }
    return false;
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/discover`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setDiscoveryData(data);

          if (data.latestResearch?.results) {
            try {
              const parsed = JSON.parse(data.latestResearch.results);
              setSuggestedKeywords(parsed.slice(0, 20));
            } catch { /* silently fail */ }
          }

          if (data.onboardingStatus === "COMPLETE") {
            setPolling(false);
          }
        }
      } catch { /* silently fail */ }
    };

    fetchStatus();

    if (polling) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [clientId, polling]);

  // Fetch already-tracked keywords so "Tracked" persists across reloads
  useEffect(() => {
    const fetchTracked = async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/keywords`);
        if (res.ok) {
          const data = await res.json();
          const existing = (data.keywords || data || []).map(
            (k: { keyword: string }) => k.keyword
          );
          if (existing.length > 0) {
            setTrackedKeywords(new Set(existing));
          }
        }
      } catch { /* silently fail */ }
    };
    fetchTracked();
  }, [clientId]);

  const isDiscovering = status === "DISCOVERING" || discoveryData?.onboardingStatus === "DISCOVERING";
  const isComplete = discoveryData?.onboardingStatus === "COMPLETE";

  const handleTrackKeyword = async (kw: {
    keyword: string;
    searchVolume: number;
    competition: number;
    cpc?: number;
  }) => {
    setTrackingInProgress((prev) => new Set([...prev, kw.keyword]));
    try {
      const res = await fetch(`/api/clients/${clientId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: [
            {
              keyword: kw.keyword,
              searchVolume: kw.searchVolume,
              difficulty: kw.competition,
              cpc: kw.cpc,
              group: "Discovery",
            },
          ],
        }),
      });
      if (res.ok) {
        setTrackedKeywords((prev) => new Set([...prev, kw.keyword]));
      }
    } catch { /* silently fail */ } finally {
      setTrackingInProgress((prev) => {
        const next = new Set(prev);
        next.delete(kw.keyword);
        return next;
      });
    }
  };

  const handleTrackAll = async () => {
    setTrackingAll(true);
    const top = suggestedKeywords.slice(0, 15);
    try {
      await fetch(`/api/clients/${clientId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: top.map((kw) => ({
            keyword: kw.keyword,
            searchVolume: kw.searchVolume,
            difficulty: kw.competition,
            cpc: kw.cpc,
            group: "Discovery",
          })),
        }),
      });
      setTrackedKeywords(new Set(top.map((k) => k.keyword)));
    } catch { /* silently fail */ } finally {
      setTrackingAll(false);
    }
  };

  const getCompColor = (c: number) => (c <= 30 ? "#10B981" : c <= 60 ? "#F59E0B" : "#EF4444");
  const getCompLabel = (c: number) => (c <= 30 ? "Low" : c <= 60 ? "Med" : "High");

  const handleDismiss = () => {
    setIsCollapsed(true);
    localStorage.setItem(`discovery-dismissed-${clientId}`, "true");
  };

  // Hide the panel entirely once dismissed
  if (isCollapsed && isComplete) {
    return null;
  }

  return (
    <div className="mb-6 animate-fade-in">
      <div
        className="stat-card"
        style={{
          padding: 0,
          overflow: "hidden",
          borderLeft: isComplete ? "3px solid #10B981" : "3px solid var(--accent)",
        }}
      >
        {/* Header */}
        <div className="p-5" style={{ borderBottom: suggestedKeywords.length > 0 ? "1px solid var(--border)" : "none" }}>
          <div className="flex items-center gap-3 mb-4">
            {isDiscovering ? (
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
            ) : isComplete ? (
              <CheckCircle2 size={24} style={{ color: "#10B981" }} />
            ) : (
              <Zap size={24} style={{ color: "var(--accent)" }} />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-extrabold">
                {isDiscovering
                  ? `Setting Up ${clientName}...`
                  : isComplete
                  ? "Discovery Complete!"
                  : "Ready to Launch Discovery"}
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {isDiscovering
                  ? "Crawling website + discovering keywords — this may take 2-5 minutes"
                  : isComplete
                  ? `Found ${discoveryData?.latestResearch?.keywordsFound || 0} keywords from your site and competitors`
                  : "Click Launch to start automatic site analysis and keyword discovery"}
              </p>
            </div>
            {isComplete && (
              <button
                onClick={handleDismiss}
                title="Dismiss"
                className="ml-auto text-sm font-bold rounded-lg px-2 py-1 transition-all hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Steps Checklist */}
          <div className="flex flex-col gap-2 ml-1">
            <StepItem
              label="Business profile saved"
              done={true}
            />
            <StepItem
              label={`Site audit ${isDiscovering ? "running" : isComplete ? "complete" : "pending"}...`}
              done={isComplete}
              loading={isDiscovering}
              detail={domain ? `Crawling ${domain}` : undefined}
            />
            <StepItem
              label={`Keyword discovery ${isDiscovering ? "running" : isComplete ? "complete" : "pending"}...`}
              done={isComplete}
              loading={isDiscovering}
              detail={
                discoveryData?.latestResearch
                  ? `${discoveryData.latestResearch.keywordsFound} keywords found`
                  : undefined
              }
            />
            <StepItem
              label="Review suggested keywords"
              done={trackedKeywords.size > 0}
              loading={false}
            />
          </div>

          {/* Action Links */}
          {isComplete && (
            <div className="flex gap-3 mt-4">
              <a
                href={`/agency/clients/${clientId}/audit`}
                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                <Search size={12} className="inline mr-1" /> View Site Audit
              </a>
              <a
                href={`/agency/clients/${clientId}/research`}
                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                style={{ background: "rgba(139,92,246,0.15)", color: "#8B5CF6" }}
              >
                <Microscope size={12} className="inline mr-1" /> View Full Research
              </a>
            </div>
          )}
        </div>

        {/* Suggested Keywords Table */}
        {isComplete && suggestedKeywords.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <h4 className="text-sm font-extrabold flex items-center gap-2">
                <Sparkles size={14} style={{ color: "var(--accent)" }} />
                Top Suggested Keywords
              </h4>
              <button
                onClick={handleTrackAll}
                disabled={trackingAll || trackedKeywords.size >= 15}
                className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                {trackingAll ? (
                  <Loader2 size={10} className="animate-spin inline mr-1" />
                ) : (
                  <Plus size={10} className="inline mr-1" />
                )}
                Track Top 15
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Keyword</th>
                    <th>Volume</th>
                    <th>Competition</th>
                    <th>CPC</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {suggestedKeywords.map((kw) => (
                    <tr key={kw.keyword}>
                      <td>
                        <span className="text-sm font-semibold">{kw.keyword}</span>
                      </td>
                      <td>
                        <span className="text-sm font-bold">{kw.searchVolume.toLocaleString()}</span>
                      </td>
                      <td>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            background: `${getCompColor(kw.competition)}20`,
                            color: getCompColor(kw.competition),
                          }}
                        >
                          {getCompLabel(kw.competition)}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          ${kw.cpc.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        {trackedKeywords.has(kw.keyword) ? (
                          <span className="text-[10px] font-bold" style={{ color: "#10B981" }}>
                            <CheckCircle2 size={12} className="inline mr-1" />
                            Tracked
                          </span>
                        ) : trackingInProgress.has(kw.keyword) ? (
                          <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>
                            <Loader2 size={12} className="inline mr-1 animate-spin" />
                            Tracking...
                          </span>
                        ) : (
                          <button
                            onClick={() => handleTrackKeyword(kw)}
                            className="text-[10px] font-bold px-2 py-1 rounded transition-all hover:opacity-80"
                            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                          >
                            <Plus size={10} className="inline" /> Track
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepItem({
  label,
  done,
  loading = false,
  detail,
}: {
  label: string;
  done: boolean;
  loading?: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {done ? (
        <CheckCircle2 size={16} style={{ color: "#10B981", flexShrink: 0 }} />
      ) : loading ? (
        <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)", flexShrink: 0 }} />
      ) : (
        <div
          className="w-4 h-4 rounded-full border-2"
          style={{ borderColor: "var(--border)", flexShrink: 0 }}
        />
      )}
      <span style={{ color: done ? "var(--text-primary)" : "var(--text-muted)" }}>
        {label}
      </span>
      {detail && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          — {detail}
        </span>
      )}
    </div>
  );
}

export default function ClientOverview() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const [data, setData] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Archive & Delete
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    tier: "STARTER",
    domain: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    notes: "",
    gbpName: "",
    gbpUrl: "",
    gbpPhone: "",
    gbpAddress: "",
    gbpCategory: "",
    gscProperty: "",
    ga4PropertyId: "",
    sitemapUrl: "",
    monthlyBlogs: 2,
    monthlyGbpPosts: 2,
    monthlyGbpQAs: 2,
    monthlyPressReleases: 1,
    monthlyDirectoryListings: 25,
    businessDescription: "",
    // Comma-separated text fields. Stored as JSON arrays in the DB; we
    // keep them as plain strings while editing so commas/spaces don't get
    // stripped on every keystroke. handleSave does the JSON-stringify.
    primaryServices: "",
    serviceAreas: "",
    targetCities: "",
    brandTerms: "",
    idealClientProfile: "",
    priceRange: "",
    industryVertical: "",
    // icpPains stays as a JSON string in editForm because the tag-list UI
    // mutates it as a structured value, not a free-typed string.
    icpPains: "",
    avgCpcUsd: 3.5,
  });
  const [painSuggestions, setPainSuggestions] = useState<string[]>([]);
  const [suggestingPains, setSuggestingPains] = useState(false);
  const [painSuggestError, setPainSuggestError] = useState("");
  const [painInput, setPainInput] = useState("");

  useEffect(() => {
    fetch(`/api/clients/${clientId}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  const openEdit = () => {
    if (!data) return;
    setEditForm({
      name: data.name || "",
      tier: data.tier || "STARTER",
      domain: data.domain || "",
      contactName: data.contactName || "",
      contactEmail: data.contactEmail || "",
      contactPhone: data.contactPhone || "",
      address: data.address || "",
      city: data.city || "",
      state: data.state || "",
      zip: data.zip || "",
      notes: data.notes || "",
      gbpName: data.gbpName || "",
      gbpUrl: data.gbpUrl || "",
      gbpPhone: data.gbpPhone || "",
      gbpAddress: data.gbpAddress || "",
      gbpCategory: data.gbpCategory || "",
      gscProperty: data.gscProperty || "",
      ga4PropertyId: data.ga4PropertyId || "",
      sitemapUrl: data.sitemapUrl || "",
      monthlyBlogs: data.monthlyBlogs || 2,
      monthlyGbpPosts: data.monthlyGbpPosts || 2,
      monthlyGbpQAs: data.monthlyGbpQAs || 2,
      monthlyPressReleases: data.monthlyPressReleases || 1,
      monthlyDirectoryListings: data.monthlyDirectoryListings || 25,
      businessDescription: data.businessDescription || "",
      // JSON-array fields → joined comma string for editing
      primaryServices: jsonArrayToCommaString(data.primaryServices),
      serviceAreas: jsonArrayToCommaString(data.serviceAreas),
      targetCities: jsonArrayToCommaString(data.targetCities),
      brandTerms: jsonArrayToCommaString(data.brandTerms),
      idealClientProfile: data.idealClientProfile || "",
      priceRange: data.priceRange || "",
      industryVertical: data.industryVertical || "",
      // icpPains stays JSON-stringified (tag-list reads/writes the JSON form)
      icpPains: data.icpPains || "",
      avgCpcUsd: data.avgCpcUsd ?? 3.5,
    });
    setPainSuggestions([]);
    setPainSuggestError("");
    setPainInput("");
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Convert the comma-separated text fields back to JSON arrays before
      // sending. icpPains is already a JSON string (tag-list manages it).
      const payload = {
        ...editForm,
        primaryServices: commaStringToJsonArray(editForm.primaryServices),
        serviceAreas: commaStringToJsonArray(editForm.serviceAreas),
        targetCities: commaStringToJsonArray(editForm.targetCities),
        brandTerms: commaStringToJsonArray(editForm.brandTerms),
      };
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setData((prev) => (prev ? { ...prev, ...updated } : prev));
        setIsEditing(false);
        // Notify layout to refresh header (name, domain, tier)
        window.dispatchEvent(new CustomEvent("client-updated", { detail: updated }));
      }
    } catch {
      // silently fail
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (res.ok) {
        router.push("/agency/clients");
      }
    } finally {
      setArchiving(false);
    }
  };

  const handlePermanentDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/agency/clients");
      }
    } finally {
      setDeleting(false);
    }
  };

  const updateField = (field: string, value: string | number) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTierChange = (newTier: string) => {
    const defaults = TIER_DEFAULTS[newTier];
    if (defaults) {
      setEditForm((prev) => ({
        ...prev,
        tier: newTier,
        monthlyBlogs: defaults.monthlyBlogs,
        monthlyGbpPosts: defaults.monthlyGbpPosts,
        monthlyGbpQAs: defaults.monthlyGbpQAs,
        monthlyPressReleases: defaults.monthlyPressReleases,
        monthlyDirectoryListings: defaults.monthlyDirectoryListings,
      }));
    } else {
      setEditForm((prev) => ({ ...prev, tier: newTier }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2
          size={24}
          className="animate-spin"
          style={{ color: "var(--accent)" }}
        />
      </div>
    );
  }
  if (!data)
    return (
      <p style={{ color: "var(--text-muted)" }}>Error loading client data</p>
    );

  // Compute metrics
  const keywords = data.keywords || [];
  const latestPositions = keywords
    .map((kw) => kw.snapshots?.[0]?.position)
    .filter((p): p is number => p != null);
  const page1Keywords = latestPositions.filter((p) => p <= 10).length;
  const avgPosition =
    latestPositions.length > 0
      ? (
          latestPositions.reduce((a, b) => a + b, 0) / latestPositions.length
        ).toFixed(1)
      : "—";

  // Position changes
  const posChanges = keywords
    .map((kw) => {
      const s = kw.snapshots?.[0];
      if (s?.position && s?.previousPos) return s.previousPos - s.position;
      return null;
    })
    .filter((c): c is number => c !== null);
  const avgChange =
    posChanges.length > 0
      ? (posChanges.reduce((a, b) => a + b, 0) / posChanges.length).toFixed(1)
      : 0;

  // Health
  const deliverables = data.deliverables || [];
  const completedDel = deliverables.filter(
    (d) => d.status === "COMPLETED"
  ).length;
  const healthPct =
    deliverables.length > 0
      ? Math.round((completedDel / deliverables.length) * 100)
      : 0;

  // Top movers
  const topMovers = keywords
    .map((kw) => {
      const change =
        kw.snapshots?.[0]?.previousPos && kw.snapshots?.[0]?.position
          ? kw.snapshots[0].previousPos - kw.snapshots[0].position
          : 0;
      return {
        ...kw,
        change,
        position: kw.snapshots?.[0]?.position || null,
      };
    })
    .filter((k) => k.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 5);

  // Content plan
  const currentPlan = data.contentPlans?.[0];
  const pendingApprovals =
    currentPlan?.pieces.filter((p) => p.status === "CLIENT_REVIEW").length || 0;

  // Build chart data ONLY from real snapshots
  const hasRankingData = keywords.length > 0 && latestPositions.length > 0;

  return (
    <div className="max-w-6xl stagger">
      {/* ─── Onboarding Progress Tracker ─── */}
      {data.onboardingStatus && (
        <OnboardingTracker clientId={clientId} clientName={data.name} domain={data.domain} status={data.onboardingStatus} />
      )}

      {/* Edit Button */}
      <div className="flex justify-end mb-4">
        <button onClick={openEdit} className="btn-secondary text-sm">
          <Settings2 size={14} />
          Edit Client
        </button>
      </div>

      {/* Edit Panel */}
      {isEditing && (
        <div
          className="stat-card mb-6 animate-fade-in"
          style={{ padding: 0, overflow: "hidden" }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h3 className="text-lg font-extrabold">Edit Client</h3>
            <button
              onClick={() => setIsEditing(false)}
              className="p-2 rounded-lg hover:bg-white/5"
            >
              <X size={18} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>

          <div className="p-6">
            {/* Basic Info */}
            <h4
              className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
              style={{ color: "var(--accent)" }}
            >
              <Building2 size={14} />
              Business Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <EditField
                label="Business Name"
                value={editForm.name}
                onChange={(v) => updateField("name", v)}
                placeholder="Company Name"
              />
              <EditField
                label="Website Domain"
                value={editForm.domain}
                onChange={(v) => updateField("domain", v)}
                placeholder="example.com"
                icon={<Globe size={14} />}
              />
              <EditField
                label="Contact Name"
                value={editForm.contactName}
                onChange={(v) => updateField("contactName", v)}
                placeholder="John Smith"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <EditField
                label="Email"
                value={editForm.contactEmail}
                onChange={(v) => updateField("contactEmail", v)}
                placeholder="john@company.com"
                type="email"
                icon={<Mail size={14} />}
              />
              <EditField
                label="Phone"
                value={editForm.contactPhone}
                onChange={(v) => updateField("contactPhone", v)}
                placeholder="(555) 123-4567"
                icon={<Phone size={14} />}
              />
              <EditField
                label="Address"
                value={editForm.address}
                onChange={(v) => updateField("address", v)}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <EditField
                label="City"
                value={editForm.city}
                onChange={(v) => updateField("city", v)}
                placeholder="Denver"
              />
              <EditField
                label="State"
                value={editForm.state}
                onChange={(v) => updateField("state", v)}
                placeholder="CO"
              />
              <EditField
                label="ZIP"
                value={editForm.zip}
                onChange={(v) => updateField("zip", v)}
                placeholder="80202"
              />
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wide mb-1.5 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Notes
                </label>
                <input
                  className="input-field"
                  value={editForm.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Internal notes..."
                />
              </div>
            </div>

            {/* GBP Info */}
            <h4
              className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
              style={{ color: "#4285F4" }}
            >
              <MapPin size={14} />
              Google Business Profile
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <EditField
                label="GBP Listing Name"
                value={editForm.gbpName}
                onChange={(v) => updateField("gbpName", v)}
                placeholder="Business Name on Google"
              />
              <EditField
                label="GBP Profile URL"
                value={editForm.gbpUrl}
                onChange={(v) => updateField("gbpUrl", v)}
                placeholder="https://maps.google.com/..."
                icon={<Globe size={14} />}
              />
              <EditField
                label="GBP Category"
                value={editForm.gbpCategory}
                onChange={(v) => updateField("gbpCategory", v)}
                placeholder="e.g. HVAC Contractor"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <EditField
                label="GBP Phone"
                value={editForm.gbpPhone}
                onChange={(v) => updateField("gbpPhone", v)}
                placeholder="(555) 123-4567"
                icon={<Phone size={14} />}
              />
              <EditField
                label="GBP Address"
                value={editForm.gbpAddress}
                onChange={(v) => updateField("gbpAddress", v)}
                placeholder="Address listed on GBP"
                icon={<MapPin size={14} />}
              />
            </div>

            {/* Google Integration */}
            <h4
              className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
              style={{ color: "#34a853" }}
            >
              <BarChart3 size={14} />
              Google Analytics & Search Console
            </h4>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Enter the GA4 Property ID and Search Console property for this client. Your Google account (freddy@kangomedia.com) must have manager access to these properties.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <EditField
                label="GA4 Property ID"
                value={editForm.ga4PropertyId}
                onChange={(v) => updateField("ga4PropertyId", v)}
                placeholder="e.g. 123456789"
                icon={<BarChart3 size={14} />}
              />
              <EditField
                label="Search Console Property"
                value={editForm.gscProperty}
                onChange={(v) => updateField("gscProperty", v)}
                placeholder="e.g. sc-domain:example.com"
                icon={<Globe size={14} />}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 mb-8">
              <EditField
                label="Sitemap URL (optional — defaults to /sitemap.xml)"
                value={editForm.sitemapUrl}
                onChange={(v) => updateField("sitemapUrl", v)}
                placeholder="e.g. https://example.com/sitemap_index.xml"
                icon={<Globe size={14} />}
              />
            </div>

            {/* Business Profile (AI Keyword Targeting) */}
            <h4
              className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
              style={{ color: "#8b5cf6" }}
            >
              <Sparkles size={14} />
              Business Profile (AI Keyword Targeting)
            </h4>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              These fields help the AI generate high-quality, business-relevant keyword research.
              The more context you provide, the better the keyword recommendations will be.
            </p>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wide mb-2 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Business Description
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={editForm.businessDescription}
                  onChange={(e) => updateField("businessDescription", e.target.value)}
                  placeholder="e.g. Custom website development and SEO services for contractors and home service companies. Typical project value $10K-50K."
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wide mb-2 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Industry Vertical
                </label>
                <IndustryVerticalSelect
                  value={editForm.industryVertical}
                  onChange={(v) => updateField("industryVertical", v)}
                />
              </div>
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wide mb-2 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Price Range
                </label>
                <select
                  className="input-field"
                  value={editForm.priceRange}
                  onChange={(e) => updateField("priceRange", e.target.value)}
                >
                  <option value="">Select price range...</option>
                  <option value="budget">Budget (under $1K)</option>
                  <option value="mid-range">Mid-range ($1K - $5K)</option>
                  <option value="premium">Premium ($5K - $25K)</option>
                  <option value="enterprise">Enterprise ($25K+)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <EditField
                label="Primary Services (comma-separated)"
                value={editForm.primaryServices}
                onChange={(v) => updateField("primaryServices", v)}
                placeholder="e.g. custom websites, SEO, web applications"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-wide mb-2 block"
                  style={{ color: "var(--text-muted)" }}
                >
                  Ideal Client Profile
                </label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={editForm.idealClientProfile}
                  onChange={(e) => updateField("idealClientProfile", e.target.value)}
                  placeholder="e.g. Large contractor companies with $5M+ revenue looking for premium digital presence"
                />
              </div>
            </div>

            {/* ── ICP Pains (drives pain-point keyword research) ── */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  Top Pain Points <span className="font-normal normal-case" style={{ color: "var(--text-muted)" }}>— problems the ICP complains about</span>
                </label>
                <button
                  type="button"
                  onClick={async () => {
                    setSuggestingPains(true);
                    setPainSuggestError("");
                    try {
                      // editForm.primaryServices is a comma-separated string
                      const services = editForm.primaryServices
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      const res = await fetch("/api/wizard/suggest-pains", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          businessDescription: editForm.businessDescription || undefined,
                          idealClientProfile: editForm.idealClientProfile || undefined,
                          industryVertical: editForm.industryVertical || editForm.gbpCategory || undefined,
                          primaryServices: services,
                        }),
                      });
                      if (!res.ok) {
                        const d = await res.json().catch(() => ({}));
                        throw new Error(d.error || "Suggestion failed");
                      }
                      const data = await res.json();
                      const current = (() => {
                        try { const a = JSON.parse(editForm.icpPains || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
                      })();
                      const fresh = (data.pains || []).filter((p: string) => !current.includes(p));
                      setPainSuggestions(fresh);
                    } catch (e) {
                      setPainSuggestError(e instanceof Error ? e.message : "Suggestion failed");
                    } finally {
                      setSuggestingPains(false);
                    }
                  }}
                  disabled={suggestingPains || (!editForm.businessDescription && !editForm.idealClientProfile && !editForm.industryVertical && !editForm.primaryServices)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    background: "rgba(124,58,237,0.12)",
                    color: "#7C3AED",
                    opacity:
                      suggestingPains || (!editForm.businessDescription && !editForm.idealClientProfile && !editForm.industryVertical && !editForm.primaryServices)
                        ? 0.5
                        : 1,
                    cursor: suggestingPains ? "wait" : "pointer",
                  }}
                  title="Claude reads this client's profile and proposes pain candidates"
                >
                  {suggestingPains ? (
                    <>
                      <Loader2 size={11} className="animate-spin" />
                      Thinking…
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} />
                      Suggest from profile
                    </>
                  )}
                </button>
              </div>

              {/* Input row */}
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="e.g. losing leads to no-shows"
                  value={painInput}
                  onChange={(e) => setPainInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const v = painInput.trim();
                      if (!v) return;
                      const list = (() => {
                        try { const a = JSON.parse(editForm.icpPains || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
                      })();
                      if (list.length < 12 && !list.includes(v)) {
                        updateField("icpPains", JSON.stringify([...list, v]));
                      }
                      setPainInput("");
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const v = painInput.trim();
                    if (!v) return;
                    const list = (() => {
                      try { const a = JSON.parse(editForm.icpPains || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
                    })();
                    if (list.length < 12 && !list.includes(v)) {
                      updateField("icpPains", JSON.stringify([...list, v]));
                    }
                    setPainInput("");
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* AI suggestion chips */}
              {painSuggestError && (
                <p className="text-[10px] mt-1.5" style={{ color: "var(--danger)" }}>
                  {painSuggestError}
                </p>
              )}
              {painSuggestions.length > 0 && (
                <div
                  className="mt-2 p-3 rounded-lg"
                  style={{
                    background: "rgba(124,58,237,0.06)",
                    border: "1px dashed rgba(124,58,237,0.30)",
                  }}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "#7C3AED" }}>
                    AI Suggestions · click to add
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {painSuggestions.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                        style={{
                          background: "rgba(124,58,237,0.12)",
                          color: "#7C3AED",
                          border: "1px solid rgba(124,58,237,0.25)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const list = (() => {
                              try { const a = JSON.parse(editForm.icpPains || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
                            })();
                            if (list.length < 12 && !list.includes(p)) {
                              updateField("icpPains", JSON.stringify([...list, p]));
                            }
                            setPainSuggestions(painSuggestions.filter((x) => x !== p));
                          }}
                          className="hover:opacity-70"
                        >
                          + {p}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPainSuggestions(painSuggestions.filter((x) => x !== p))}
                          className="opacity-50 hover:opacity-100"
                          title="Dismiss"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing tags */}
              {(() => {
                let list: string[] = [];
                try { const a = JSON.parse(editForm.icpPains || "[]"); if (Array.isArray(a)) list = a; } catch {}
                if (list.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {list.map((p) => (
                      <span
                        key={p}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer hover:opacity-70 transition-all"
                        style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}
                        onClick={() => updateField("icpPains", JSON.stringify(list.filter((x) => x !== p)))}
                      >
                        {p} ×
                      </span>
                    ))}
                  </div>
                );
              })()}
              <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>
                Drives the pain-point keyword research mode. The Suggest button uses Claude to propose pains specific to this client&apos;s profile.
              </p>
            </div>

            {/* ── Target Cities (specific cities served) ── */}
            <div className="mb-4">
              <EditField
                label="Target Cities (comma-separated)"
                value={editForm.targetCities}
                onChange={(v) => updateField("targetCities", v)}
                placeholder="e.g. Westminster, CO, Denver, CO, Aurora, CO"
              />
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                Specific cities the client actively serves. Used by keyword research for local-intent seeds.
              </p>
            </div>

            {/* ── Service Areas (geographic regions, broader than cities) ── */}
            <div className="mb-4">
              <EditField
                label="Service Areas (broader regions, comma-separated)"
                value={editForm.serviceAreas}
                onChange={(v) => updateField("serviceAreas", v)}
                placeholder="e.g. Denver Metro, Northern Colorado — leave blank if not relevant"
              />
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                Broader geographic regions, distinct from individual cities. Leave empty if the client doesn&apos;t market named regions.
              </p>
            </div>

            {/* ── Brand Terms (for branded vs non-branded query split) ── */}
            <div className="mb-4">
              <EditField
                label="Brand Terms (comma-separated; auto-derived if blank)"
                value={editForm.brandTerms}
                onChange={(v) => updateField("brandTerms", v)}
                placeholder="e.g. kangomedia, kango"
              />
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                Used to separate branded clicks from non-branded clicks in performance reports. Leave blank to derive from name + domain.
              </p>
            </div>

            {/* ── Average CPC ── */}
            <div className="mb-8">
              <label
                className="text-xs font-bold uppercase tracking-wide mb-2 block"
                style={{ color: "var(--text-muted)" }}
              >
                Avg CPC Fallback (USD)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                className="input-field"
                value={editForm.avgCpcUsd}
                onChange={(e) =>
                  updateField("avgCpcUsd", parseFloat(e.target.value) || 0)
                }
                placeholder="3.50"
              />
              <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                Used only when DataForSEO has no advertiser data for a query. Real CPC is computed per-query when available — bump this up only for verticals where the long tail rarely has DataForSEO data (legal $40+, medical $20+, home services $15+).
              </p>
            </div>

            {/* Service Plan */}
            <h4
              className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
              style={{ color: "var(--accent)" }}
            >
              <ListChecks size={14} />
              Service Plan & Deliverables
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>Plan</label>
                <select
                  className="input-field"
                  value={editForm.tier}
                  onChange={(e) => handleTierChange(e.target.value)}
                >
                  <option value="STARTER">Local Visibility — $400/mo</option>
                  <option value="GROWTH">Growth SEO — $800/mo</option>
                  <option value="PRO">Authority SEO — $1,500/mo</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <EditField
                label="Blog Posts / Month"
                value={String(editForm.monthlyBlogs)}
                onChange={(v) => updateField("monthlyBlogs", parseInt(v) || 0)}
                type="number"
              />
              <EditField
                label="GBP Posts / Month"
                value={String(editForm.monthlyGbpPosts)}
                onChange={(v) => updateField("monthlyGbpPosts", parseInt(v) || 0)}
                type="number"
              />
              <EditField
                label="GBP Q&As / Month"
                value={String(editForm.monthlyGbpQAs)}
                onChange={(v) => updateField("monthlyGbpQAs", parseInt(v) || 0)}
                type="number"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <EditField
                label="Press Releases / Month"
                value={String(editForm.monthlyPressReleases)}
                onChange={(v) => updateField("monthlyPressReleases", parseInt(v) || 0)}
                type="number"
              />
              <EditField
                label="Directory Listings / Month"
                value={String(editForm.monthlyDirectoryListings)}
                onChange={(v) => updateField("monthlyDirectoryListings", parseInt(v) || 0)}
                type="number"
              />
            </div>

            {/* ─── Danger Zone (inside edit panel) ────────── */}
            <div className="mt-4 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
              <h4
                className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
                style={{ color: "var(--danger)" }}
              >
                <AlertTriangle size={14} />
                Danger Zone
              </h4>
              <div className="rounded-xl" style={{ border: "1px solid rgba(239,68,68,0.2)", overflow: "hidden" }}>
                {/* Archive */}
                <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(239,68,68,0.1)" }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Archive this client</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Hides from dashboard. Data preserved & restorable.</p>
                  </div>
                  <button onClick={() => setShowArchiveModal(true)} className="btn-secondary text-xs" style={{ borderColor: "#F59E0B", color: "#F59E0B", padding: "6px 12px" }}>
                    <Archive size={12} />
                    Archive
                  </button>
                </div>
                {/* Permanently Delete */}
                <div className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Permanently delete</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Irreversibly removes all data.</p>
                  </div>
                  <button onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(""); }} className="btn-secondary text-xs" style={{ borderColor: "var(--danger)", color: "var(--danger)", padding: "6px 12px" }}>
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Save */}
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => setIsEditing(false)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary text-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={14} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Info Summary (visible when not editing) */}
      {!isEditing && (data.gbpName || data.contactEmail || data.contactPhone) && (
        <div
          className="stat-card mb-6 flex flex-wrap items-center gap-4"
          style={{ padding: "14px 20px" }}
        >
          {data.domain && (
            <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <Globe size={12} /> {data.domain}
            </span>
          )}
          {data.contactEmail && (
            <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <Mail size={12} /> {data.contactEmail}
            </span>
          )}
          {data.contactPhone && (
            <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <Phone size={12} /> {data.contactPhone}
            </span>
          )}
          {data.gbpName && (
            <span className="text-xs flex items-center gap-1.5" style={{ color: "#4285F4" }}>
              <MapPin size={12} /> {data.gbpName}
            </span>
          )}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MiniStat
          label="Page 1 Keywords"
          value={page1Keywords}
          change={
            page1Keywords > 0 ? `${page1Keywords} on page 1` : undefined
          }
          positive
        />
        <MiniStat
          label="Avg. Position"
          value={avgPosition}
          change={
            Number(avgChange) > 0
              ? `↑ ${avgChange} positions`
              : undefined
          }
          positive={Number(avgChange) > 0}
        />
        <MiniStat label="Keywords Tracked" value={keywords.length} />
        <MiniStat
          label="Health Score"
          value={deliverables.length > 0 ? `${healthPct}%` : "—"}
        />
      </div>

      {/* Chart + Top Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div
          className="stat-card lg:col-span-2"
          style={{ padding: "20px 20px 10px" }}
        >
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            Ranking Trend (30 days)
          </h3>
          {hasRankingData ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={keywords[0]?.snapshots
                  ?.slice()
                  .reverse()
                  .map((s) => ({
                    date: new Date(s.checkedAt)
                      .toISOString()
                      .split("T")[0],
                    avgPosition: s.position || 0,
                  })) || []}
              >
                <defs>
                  <linearGradient
                    id="rankGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#E34234"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor="#E34234"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(148,163,184,0.1)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#64748B" }}
                  tickFormatter={(d) =>
                    new Date(d).getDate().toString()
                  }
                />
                <YAxis
                  reversed
                  domain={["dataMin - 2", "dataMax + 2"]}
                  tick={{ fontSize: 10, fill: "#64748B" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1A1F2E",
                    border: "1px solid #232939",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="avgPosition"
                  stroke="#E34234"
                  strokeWidth={2}
                  fill="url(#rankGrad)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[220px]">
              <BarChart3
                size={32}
                style={{ color: "var(--text-muted)" }}
                className="mb-3"
              />
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                No ranking data yet
              </p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-muted)" }}
              >
                Add keywords in the Rankings tab to start tracking
              </p>
            </div>
          )}
        </div>

        <div className="stat-card" style={{ padding: "20px" }}>
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: "var(--text-primary)" }}
          >
            <TrendingUp
              size={14}
              className="inline mr-2"
              style={{ color: "var(--success)" }}
            />
            Top Movers
          </h3>
          <div className="flex flex-col gap-3">
            {topMovers.map((kw) => (
              <div key={kw.id} className="flex items-center justify-between">
                <div className="min-w-0 flex-1 mr-3">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {kw.keyword}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    #{kw.position} · {kw.searchVolume?.toLocaleString()}{" "}
                    vol
                  </p>
                </div>
                <span
                  className="text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1"
                  style={{
                    background: "rgba(16,185,129,0.12)",
                    color: "var(--success)",
                  }}
                >
                  <TrendingUp size={12} />+{kw.change}
                </span>
              </div>
            ))}
            {topMovers.length === 0 && (
              <p
                className="text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                No ranking improvements yet
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Deliverables + Content Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card" style={{ padding: "20px" }}>
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-sm font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              <ListChecks
                size={14}
                className="inline mr-2"
                style={{ color: "var(--accent)" }}
              />
              Deliverables
            </h3>
            <span
              className="text-xs font-bold"
              style={{ color: "var(--text-muted)" }}
            >
              {completedDel}/{deliverables.length} complete
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {deliverables.slice(0, 6).map((del) => (
              <div key={del.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {del.status === "COMPLETED" ? (
                      <CheckCircle2
                        size={14}
                        style={{ color: "var(--success)" }}
                      />
                    ) : del.status === "IN_PROGRESS" ? (
                      <Clock size={14} style={{ color: "#F59E0B" }} />
                    ) : (
                      <AlertCircle
                        size={14}
                        style={{ color: "var(--text-muted)" }}
                      />
                    )}
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {del.name}
                    </span>
                  </div>
                  <span
                    className="text-xs font-bold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {del.currentCount}/{del.targetCount}
                  </span>
                </div>
                <div className="progress-bar" style={{ height: 3 }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${(del.currentCount / del.targetCount) * 100}%`,
                      background:
                        del.status === "COMPLETED"
                          ? "var(--success)"
                          : "var(--accent)",
                    }}
                  />
                </div>
              </div>
            ))}
            {deliverables.length === 0 && (
              <p
                className="text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                No deliverables set up yet
              </p>
            )}
          </div>
        </div>

        <div className="stat-card" style={{ padding: "20px" }}>
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-sm font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              <FileText
                size={14}
                className="inline mr-2"
                style={{ color: "var(--accent)" }}
              />
              Content Pipeline
            </h3>
            {pendingApprovals > 0 && (
              <span
                className="text-xs font-bold px-2 py-1 rounded-lg"
                style={{
                  background: "rgba(245,158,11,0.12)",
                  color: "#F59E0B",
                }}
              >
                {pendingApprovals} pending approval
              </span>
            )}
          </div>
          {currentPlan ? (
            <div className="flex flex-col gap-2">
              {currentPlan.pieces.slice(0, 6).map((piece) => {
                const typeIcon =
                  piece.type === "BLOG_POST"
                    ? "✍️"
                    : piece.type === "GBP_POST"
                    ? "📍"
                    : "📢";
                const statusMap: Record<string, string> = {
                  PLANNED: "status-draft",
                  CLIENT_REVIEW: "status-review",
                  APPROVED: "status-approved",
                  WRITING: "status-review",
                  PUBLISHED: "status-published",
                  REJECTED: "status-rejected",
                };
                return (
                  <div
                    key={piece.id}
                    className="flex items-center gap-3 p-2 rounded-lg"
                  >
                    <span className="text-sm">{typeIcon}</span>
                    <p
                      className="flex-1 text-sm font-semibold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {piece.title}
                    </p>
                    <span
                      className={`status-badge ${statusMap[piece.status] || "status-draft"}`}
                    >
                      {piece.status.replace("_", " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              No content plan for this month
            </p>
          )}
        </div>
      </div>



      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="stat-card w-full max-w-md" style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold">Archive Client</h2>
              <button onClick={() => setShowArchiveModal(false)} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <Archive size={18} style={{ color: "#F59E0B", flexShrink: 0 }} />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Are you sure you want to archive <strong style={{ color: "var(--text-primary)" }}>{data.name}</strong>? They will be hidden but all data will be preserved.
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowArchiveModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleArchive} disabled={archiving} className="btn-primary" style={{ background: "#F59E0B" }}>
                {archiving ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                {archiving ? "Archiving..." : "Archive Client"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="stat-card w-full max-w-md" style={{ padding: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold" style={{ color: "var(--danger)" }}>Permanently Delete Client</h2>
              <button onClick={() => setShowDeleteModal(false)} style={{ color: "var(--text-muted)" }}><X size={20} /></button>
            </div>
            <div className="flex items-start gap-3 mb-4 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <AlertTriangle size={18} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="text-sm font-bold mb-1" style={{ color: "var(--danger)" }}>This action cannot be undone.</p>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  This will permanently delete <strong style={{ color: "var(--text-primary)" }}>{data.name}</strong> and all associated data — keywords, ranking history, content plans, deliverables, site audits, and reports.
                </p>
              </div>
            </div>
            <div className="mb-6">
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                Type <strong style={{ color: "var(--text-primary)" }}>{data.name}</strong> to confirm
              </label>
              <input
                className="input-field"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={data.name}
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary">Cancel</button>
              <button
                onClick={handlePermanentDelete}
                disabled={deleting || deleteConfirmText !== data.name}
                className="btn-primary text-sm"
                style={{
                  background: deleteConfirmText === data.name ? "var(--danger)" : "rgba(239,68,68,0.3)",
                  cursor: deleteConfirmText === data.name ? "pointer" : "not-allowed",
                  opacity: deleteConfirmText === data.name ? 1 : 0.5,
                }}
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deleting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

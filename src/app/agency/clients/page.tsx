"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  X,
  Loader2,
  Archive,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Target,
  MapPin,
  Globe,
  Building2,
  Sparkles,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { TIER_LABELS, TIER_COLORS } from "@/lib/tier-config";

// ─── Common Industry Categories ────────────────────────────
const INDUSTRY_CATEGORIES = [
  "Plumbing",
  "HVAC",
  "Electrical",
  "Roofing",
  "General Contractor",
  "Landscaping",
  "Pest Control",
  "Auto Repair",
  "Dental",
  "Medical",
  "Legal",
  "Real Estate",
  "Restaurant",
  "Fitness",
  "Salon / Barber",
  "Cleaning Services",
  "Moving Company",
  "Insurance",
  "Accounting / CPA",
  "Other",
];

// ─── Onboarding Wizard ────────────────────────────────────

function ClientOnboardingWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (clientId: string) => void;
}) {
  const [step, setStep] = useState(1);

  // Step 1 — Business Profile
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [tier, setTier] = useState("STARTER");
  const [category, setCategory] = useState("");
  const [primaryCity, setPrimaryCity] = useState("");
  const [primaryState, setPrimaryState] = useState("");

  // Step 2 — SEO Intake
  const [serviceInput, setServiceInput] = useState("");
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");
  const [targetCities, setTargetCities] = useState<string[]>([]);
  const [compInput, setCompInput] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);

  // Step 3 — Launch
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canProceedStep1 = name.trim() && domain.trim();
  const canLaunch = canProceedStep1;

  // Auto-populate primary city into target cities
  useEffect(() => {
    if (primaryCity && primaryState) {
      const cityStr = `${primaryCity}, ${primaryState}`;
      if (!targetCities.includes(cityStr)) {
        setTargetCities((prev) => [cityStr, ...prev]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]); // Run when moving to step 2

  const addTag = (
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    setInput: (v: string) => void,
    max: number = 10
  ) => {
    const v = value.trim();
    if (v && !list.includes(v) && list.length < max) {
      setList([...list, v]);
      setInput("");
    }
  };

  const removeTag = (value: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.filter((t) => t !== value));
  };

  const handleLaunch = async () => {
    setSaving(true);
    setError("");

    try {
      // 1. Create the client
      const createRes = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          domain: domain.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          tier,
          category,
          city: primaryCity,
          state: primaryState,
          serviceAreas,
          targetCities,
          competitors: competitors.map((c) => c.replace(/^https?:\/\//, "").replace(/\/$/, "")),
        }),
      });

      if (!createRes.ok) {
        throw new Error("Failed to create client");
      }

      const client = await createRes.json();

      // 2. Trigger discovery (non-blocking — fire and forget)
      fetch(`/api/clients/${client.id}/discover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {}); // Don't await — let it run in background

      // 3. Redirect to overview
      onCreated(client.id);
    } catch {
      setError("Failed to create client. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div className="stat-card w-full max-w-lg" style={{ padding: 0, maxHeight: "90vh", overflow: "auto" }}>
        {/* Header */}
        <div
          className="flex items-center justify-between p-5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2 className="text-xl font-extrabold">
              {step === 1 && "New Client Setup"}
              {step === 2 && "SEO Intake"}
              {step === 3 && "Review & Launch"}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Step {step} of 3
            </p>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-5 pt-4">
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className="h-1 rounded-full flex-1 transition-all duration-300"
                style={{
                  background: s <= step ? "var(--accent)" : "var(--border)",
                }}
              />
            ))}
          </div>
        </div>

        <div className="p-5">
          {/* ─── Step 1: Business Profile ─── */}
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                  Client / Business Name *
                </label>
                <input
                  className="input-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Strong Contractors"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                  Website Domain *
                </label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                  <input
                    className="input-field"
                    style={{ paddingLeft: 36 }}
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="e.g. strongcontractors.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                  Service Tier
                </label>
                <select className="input-field" value={tier} onChange={(e) => setTier(e.target.value)}>
                  <option value="STARTER">Local Visibility — $400/mo</option>
                  <option value="GROWTH">Growth SEO — $800/mo</option>
                  <option value="PRO">Authority SEO — $1,500/mo</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                  Industry Category
                </label>
                <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Select category...</option>
                  {INDUSTRY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                    Primary City
                  </label>
                  <input
                    className="input-field"
                    value={primaryCity}
                    onChange={(e) => setPrimaryCity(e.target.value)}
                    placeholder="e.g. McAllen"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                    State
                  </label>
                  <input
                    className="input-field"
                    value={primaryState}
                    onChange={(e) => setPrimaryState(e.target.value)}
                    placeholder="e.g. TX"
                  />
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="btn-primary"
                >
                  Next: SEO Intake
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: SEO Intake ─── */}
          {step === 2 && (
            <div className="flex flex-col gap-5 animate-fade-in">
              <div
                className="rounded-xl p-3 text-xs"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                <strong className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={12} /> Why we need this
                </strong>
                This helps our AI discover the most relevant keywords for your client's business. The more context, the better the recommendations.
              </div>

              {/* Service Areas */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                  <Target size={12} className="inline mr-1" />
                  Key Services / Topics
                </label>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1"
                    placeholder="e.g. kitchen remodeling"
                    value={serviceInput}
                    onChange={(e) => setServiceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(serviceInput, serviceAreas, setServiceAreas, setServiceInput);
                      }
                    }}
                  />
                  <button
                    onClick={() => addTag(serviceInput, serviceAreas, setServiceAreas, setServiceInput)}
                    className="btn-secondary"
                    disabled={serviceAreas.length >= 10}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {serviceAreas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {serviceAreas.map((s) => (
                      <span
                        key={s}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer hover:opacity-70 transition-all"
                        style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                        onClick={() => removeTag(s, serviceAreas, setServiceAreas)}
                      >
                        {s} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Target Cities */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                  <MapPin size={12} className="inline mr-1" />
                  Target Cities
                </label>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1"
                    placeholder="e.g. Edinburg, TX"
                    value={cityInput}
                    onChange={(e) => setCityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(cityInput, targetCities, setTargetCities, setCityInput);
                      }
                    }}
                  />
                  <button
                    onClick={() => addTag(cityInput, targetCities, setTargetCities, setCityInput)}
                    className="btn-secondary"
                    disabled={targetCities.length >= 10}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {targetCities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {targetCities.map((c) => (
                      <span
                        key={c}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer hover:opacity-70 transition-all"
                        style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}
                        onClick={() => removeTag(c, targetCities, setTargetCities)}
                      >
                        <MapPin size={9} /> {c} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Competitors */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-1.5 block" style={{ color: "var(--text-muted)" }}>
                  <Globe size={12} className="inline mr-1" />
                  Competitor Websites (up to 3)
                </label>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1"
                    placeholder="e.g. competitor.com"
                    value={compInput}
                    onChange={(e) => setCompInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(compInput, competitors, setCompetitors, setCompInput, 3);
                      }
                    }}
                  />
                  <button
                    onClick={() => addTag(compInput, competitors, setCompetitors, setCompInput, 3)}
                    className="btn-secondary"
                    disabled={competitors.length >= 3}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {competitors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {competitors.map((c) => (
                      <span
                        key={c}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer hover:opacity-70 transition-all"
                        style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
                        onClick={() => removeTag(c, competitors, setCompetitors)}
                      >
                        <Globe size={9} /> {c} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between mt-2">
                <button onClick={() => setStep(1)} className="btn-secondary">
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button onClick={() => setStep(3)} className="btn-primary">
                  Review
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 3: Review & Launch ─── */}
          {step === 3 && (
            <div className="flex flex-col gap-4 animate-fade-in">
              {/* Summary Card */}
              <div className="rounded-xl p-4" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black"
                    style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-extrabold">{name}</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{domain}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span style={{ color: "var(--text-muted)" }}>Tier:</span>{" "}
                    <strong>{tier === "STARTER" ? "Local Visibility" : tier === "GROWTH" ? "Growth SEO" : "Authority SEO"}</strong>
                  </div>
                  {category && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>Industry:</span>{" "}
                      <strong>{category}</strong>
                    </div>
                  )}
                  {primaryCity && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>City:</span>{" "}
                      <strong>{primaryCity}, {primaryState}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* What we'll discover */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                  What happens next
                </h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle2 size={16} style={{ color: "#10B981", marginTop: 2, flexShrink: 0 }} />
                    <span>
                      <strong>Site Audit</strong> — We'll crawl{" "}
                      <span style={{ color: "var(--accent)" }}>{domain}</span> and analyze SEO health
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle2 size={16} style={{ color: "#10B981", marginTop: 2, flexShrink: 0 }} />
                    <span>
                      <strong>Keyword Discovery</strong> — We'll find keywords from your site
                      {competitors.length > 0 && ` + ${competitors.length} competitor${competitors.length > 1 ? "s" : ""}`}
                    </span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle2 size={16} style={{ color: "#10B981", marginTop: 2, flexShrink: 0 }} />
                    <span>
                      <strong>AI Analysis</strong> — Strategic recommendations for the best keywords to target
                    </span>
                  </div>
                </div>
              </div>

              {/* Intake summary */}
              {(serviceAreas.length > 0 || targetCities.length > 0 || competitors.length > 0) && (
                <div className="rounded-xl p-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  {serviceAreas.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Services:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {serviceAreas.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {targetCities.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Cities:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {targetCities.map((c) => (
                          <span key={c} className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(16,185,129,0.15)", color: "#10B981" }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {competitors.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>Competitors:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {competitors.map((c) => (
                          <span key={c} className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="text-xs text-center font-bold" style={{ color: "var(--danger)" }}>
                  {error}
                </div>
              )}

              <div className="flex justify-between mt-2">
                <button onClick={() => setStep(2)} className="btn-secondary">
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={saving || !canLaunch}
                  className="btn-primary"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Launching...
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      Launch Discovery
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ClientData {
  id: string;
  name: string;
  domain: string | null;
  tier: string;
  onboardingStatus: string | null;
  metrics: {
    keywordsTracked: number;
    avgPosition: number;
    avgPositionChange: number;
    page1Keywords: number;
    healthScore: number;
  };
}

export default function ClientsListPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchClients = (status?: string) => {
    setLoading(true);
    const url = status === "archived" ? "/api/clients?status=archived" : "/api/clients";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setClients(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleRestore = async (clientId: string) => {
    setRestoringId(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        setClients((prev) => prev.filter((c) => c.id !== clientId));
      }
    } finally {
      setRestoringId(null);
    }
  };

  useEffect(() => {
    fetchClients(tab);
  }, [tab]);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.domain?.toLowerCase().includes(search.toLowerCase())
  );


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto stagger">
      {showAddModal && (
        <ClientOnboardingWizard
          onClose={() => setShowAddModal(false)}
          onCreated={(clientId) => {
            setShowAddModal(false);
            router.push(`/agency/clients/${clientId}`);
          }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">Clients</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {clients.length} {tab === "archived" ? "archived" : "active"} client{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        {tab === "active" && (
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add Client
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-xl" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", width: "fit-content" }}>
        <button
          onClick={() => setTab("active")}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: tab === "active" ? "var(--accent)" : "transparent",
            color: tab === "active" ? "#fff" : "var(--text-muted)",
          }}
        >
          Active
        </button>
        <button
          onClick={() => setTab("archived")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{
            background: tab === "archived" ? "rgba(245,158,11,0.15)" : "transparent",
            color: tab === "archived" ? "#F59E0B" : "var(--text-muted)",
          }}
        >
          <Archive size={14} />
          Archived
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
        <input
          className="input-field pl-10"
          placeholder={tab === "archived" ? "Search archived clients..." : "Search clients..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Client Table */}
      {filtered.length === 0 ? (
        <div className="stat-card text-center py-12">
          <p className="text-lg font-bold mb-2">{search ? "No matching clients" : "No clients yet"}</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {search ? "Try a different search term" : "Add your first client to get started"}
          </p>
        </div>
      ) : (
        <div className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Tier</th>
                <th>Keywords</th>
                <th>Page 1</th>
                <th>Avg Position</th>
                <th>Health</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => (
                <tr key={client.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold flex-shrink-0"
                        style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                      >
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          {client.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {client.domain || "—"}
                        </p>
                        {(client.onboardingStatus === "DISCOVERING" || client.onboardingStatus === "PENDING") && (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold mt-1"
                            style={{ color: "#7C3AED" }}
                          >
                            <Loader2 size={10} className="animate-spin" />
                            {client.onboardingStatus === "DISCOVERING" ? "Discovering..." : "Pending setup"}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`tier-badge ${TIER_COLORS[client.tier] || "tier-starter"}`}>{TIER_LABELS[client.tier] || client.tier}</span>
                  </td>
                  <td className="font-semibold">{client.metrics.keywordsTracked}</td>
                  <td>
                    <span className="font-bold" style={{ color: "var(--success)" }}>
                      {client.metrics.page1Keywords}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold">{client.metrics.avgPosition || "—"}</span>
                      {client.metrics.avgPositionChange !== 0 && (
                        <span
                          className="text-xs font-bold flex items-center"
                          style={{ color: client.metrics.avgPositionChange < 0 ? "var(--success)" : "var(--danger)" }}
                        >
                          {client.metrics.avgPositionChange < 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(client.metrics.avgPositionChange)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="progress-bar flex-1" style={{ height: 4, maxWidth: 60 }}>
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${client.metrics.healthScore}%`,
                            background: client.metrics.healthScore >= 80 ? "var(--success)" : client.metrics.healthScore >= 60 ? "#F59E0B" : "var(--danger)",
                          }}
                        />
                      </div>
                      <span className="text-xs font-bold">{client.metrics.healthScore}%</span>
                    </div>
                  </td>
                  <td>
                    {tab === "archived" ? (
                      <button
                        onClick={() => handleRestore(client.id)}
                        disabled={restoringId === client.id}
                        className="btn-secondary text-xs"
                        style={{ padding: "6px 12px", borderColor: "var(--success)", color: "var(--success)" }}
                      >
                        {restoringId === client.id ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        Restore
                      </button>
                    ) : (
                      <Link
                        href={`/agency/clients/${client.id}`}
                        className="btn-secondary text-xs"
                        style={{ padding: "6px 12px" }}
                      >
                        View
                        <ChevronRight size={12} />
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Microscope,
  Search,
  Loader2,
  TrendingUp,
  Target,
  Zap,
  BarChart3,
  ArrowRight,
  Clock,
  Brain,
  Plus,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  MapPin,
} from "lucide-react";

interface KeywordResult {
  keyword: string;
  searchVolume: number;
  competition: number;
  cpc: number;
  categories?: string[];
}

interface ResearchSession {
  id: string;
  seedTopics: string;
  location: string;
  results: KeywordResult[];
  aiAnalysis: string | null;
  keywordsFound: number;
  createdAt: string;
}

export default function ResearchPage() {
  const params = useParams();
  const clientId = params.clientId as string;

  // Research sessions
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  // New research form
  const [seedInput, setSeedInput] = useState("");
  const [seedTopics, setSeedTopics] = useState<string[]>([]);
  const [context, setContext] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Active results
  const [activeResults, setActiveResults] = useState<KeywordResult[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"volume" | "competition" | "cpc">("volume");

  // Tracked keywords state
  const [trackedKeywords, setTrackedKeywords] = useState<Set<string>>(new Set());
  const [trackingInProgress, setTrackingInProgress] = useState<Set<string>>(new Set());

  // Discovery suggestions
  const [discoverySuggestions, setDiscoverySuggestions] = useState<KeywordResult[]>([]);

  // Content map
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);

  const loadSessions = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/research`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
        // Auto-expand latest session
        if (data.length > 0 && !activeResults.length) {
          setActiveResults(data[0].results);
          setActiveAnalysis(data[0].aiAnalysis);
          setExpandedSession(data[0].id);
        }
      }
    } catch { /* silently fail */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // Fetch already-tracked keywords
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

    // Fetch discovery suggestions
    const fetchDiscovery = async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/discover`);
        if (res.ok) {
          const data = await res.json();
          if (data.latestResearch?.results) {
            try {
              const parsed = JSON.parse(data.latestResearch.results);
              setDiscoverySuggestions(parsed.slice(0, 20));
            } catch { /* silently fail */ }
          }
        }
      } catch { /* silently fail */ }
    };
    fetchDiscovery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const handleAddSeed = () => {
    const topic = seedInput.trim();
    if (topic && !seedTopics.includes(topic) && seedTopics.length < 5) {
      setSeedTopics([...seedTopics, topic]);
      setSeedInput("");
    }
  };

  const handleRemoveSeed = (topic: string) => {
    setSeedTopics(seedTopics.filter((t) => t !== topic));
  };

  const handleRunResearch = async () => {
    if (seedTopics.length === 0) return;
    setIsResearching(true);
    setActiveResults([]);
    setActiveAnalysis(null);

    try {
      const res = await fetch(`/api/clients/${clientId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedTopics, context }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveResults(data.keywords || []);
        setActiveAnalysis(data.aiAnalysis || null);
        setSeedTopics([]);
        setContext("");
        setShowForm(false);
        loadSessions();
      }
    } catch { /* silently fail */ } finally {
      setIsResearching(false);
    }
  };

  const handleGenerateContentMap = async (researchId: string) => {
    setIsGeneratingMap(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/content-map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ researchId }),
      });

      if (res.ok) {
        // Redirect to content hub after map generated
        window.location.href = `/agency/clients/${clientId}/content`;
      }
    } catch { /* silently fail */ } finally {
      setIsGeneratingMap(false);
    }
  };

  const sortedResults = [...activeResults].sort((a, b) => {
    if (sortBy === "volume") return b.searchVolume - a.searchVolume;
    if (sortBy === "competition") return a.competition - b.competition;
    return b.cpc - a.cpc;
  });

  const getCompetitionColor = (comp: number) => {
    if (comp <= 30) return "#10B981";
    if (comp <= 60) return "#F59E0B";
    return "#EF4444";
  };

  const getCompetitionLabel = (comp: number) => {
    if (comp <= 30) return "Low";
    if (comp <= 60) return "Medium";
    return "High";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl stagger">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-3">
            <Microscope size={28} style={{ color: "var(--accent)" }} />
            Keyword Research
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Discover high-ROI keywords with AI-powered analysis
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
        >
          <Search size={16} />
          New Research
        </button>
      </div>

      {/* Discovery Suggestions */}
      {discoverySuggestions.length > 0 && !showForm && !isResearching && (
        <div className="stat-card mb-6" style={{ padding: 0, overflow: "hidden", borderLeft: "3px solid #10B981" }}>
          <div
            className="flex items-center justify-between p-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <h3 className="text-base font-extrabold flex items-center gap-2">
              <Sparkles size={18} style={{ color: "#10B981" }} />
              AI Discovery Suggestions
            </h3>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              From onboarding keyword discovery
            </span>
          </div>
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
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
                {discoverySuggestions.map((kw) => {
                  const isTracked = trackedKeywords.has(kw.keyword);
                  const isTracking = trackingInProgress.has(kw.keyword);
                  return (
                    <tr key={kw.keyword} style={{ opacity: isTracked ? 0.6 : 1 }}>
                      <td>
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                          {kw.keyword}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm font-bold">{kw.searchVolume.toLocaleString()}</span>
                      </td>
                      <td>
                        <span
                          className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                          style={{ background: `${getCompetitionColor(kw.competition)}20`, color: getCompetitionColor(kw.competition) }}
                        >
                          {getCompetitionLabel(kw.competition)}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                          ${kw.cpc.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        {isTracked ? (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-md" style={{ color: "#10B981" }}>
                            ✓ Tracked
                          </span>
                        ) : isTracking ? (
                          <Loader2 size={12} className="animate-spin" style={{ color: "var(--accent)" }} />
                        ) : (
                          <button
                            onClick={async () => {
                              setTrackingInProgress((prev) => new Set([...prev, kw.keyword]));
                              try {
                                const res = await fetch(`/api/clients/${clientId}/keywords`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    keywords: [{ keyword: kw.keyword, searchVolume: kw.searchVolume, difficulty: kw.competition, group: "Discovery" }],
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
                            }}
                            className="text-[10px] font-bold px-2 py-1 rounded-md transition-all hover:opacity-80"
                            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                          >
                            <Plus size={10} className="inline" /> Track
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Research Form */}
      {showForm && (
        <div className="stat-card mb-6 animate-fade-in" style={{ padding: 24 }}>
          <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
            <Target size={20} style={{ color: "var(--accent)" }} />
            Start Keyword Research
          </h3>

          {/* Seed Topics Input */}
          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Seed Topics (up to 5)
            </label>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                placeholder="e.g. plumber near me, drain cleaning, water heater repair"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddSeed(); } }}
              />
              <button onClick={handleAddSeed} className="btn-secondary" disabled={seedTopics.length >= 5}>
                <Plus size={16} />
              </button>
            </div>
            {seedTopics.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {seedTopics.map((topic) => (
                  <span
                    key={topic}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all hover:opacity-70"
                    style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                    onClick={() => handleRemoveSeed(topic)}
                  >
                    <Target size={10} /> {topic} ×
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Optional Context */}
          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Additional Context (optional)
            </label>
            <textarea
              className="input-field resize-none"
              rows={2}
              placeholder="e.g. Focus on emergency services, target homeowners aged 30-50"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunResearch}
            disabled={isResearching || seedTopics.length === 0}
            className="btn-primary"
          >
            {isResearching ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Researching keywords...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Run AI Research ({seedTopics.length} topic{seedTopics.length !== 1 ? "s" : ""})
              </>
            )}
          </button>
        </div>
      )}

      {/* Research Loading State */}
      {isResearching && (
        <div className="stat-card text-center py-16 mb-6 animate-fade-in">
          <Loader2 size={40} className="animate-spin mx-auto mb-4" style={{ color: "var(--accent)" }} />
          <h3 className="text-lg font-extrabold mb-2">Running Keyword Research</h3>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Querying DataForSEO + analyzing with Claude AI...
          </p>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            This may take 30-60 seconds
          </p>
        </div>
      )}

      {/* Results Section */}
      {activeResults.length > 0 && !isResearching && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="stat-card text-center">
              <div className="text-2xl font-black" style={{ color: "var(--accent)" }}>
                {activeResults.length}
              </div>
              <div className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Keywords Found</div>
            </div>
            <div className="stat-card text-center">
              <div className="text-2xl font-black" style={{ color: "#10B981" }}>
                {activeResults.filter((k) => k.competition <= 30).length}
              </div>
              <div className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Low Competition</div>
            </div>
            <div className="stat-card text-center">
              <div className="text-2xl font-black" style={{ color: "#F59E0B" }}>
                {Math.max(...activeResults.map((k) => k.searchVolume)).toLocaleString()}
              </div>
              <div className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Max Volume</div>
            </div>
            <div className="stat-card text-center">
              <div className="text-2xl font-black" style={{ color: "#8B5CF6" }}>
                ${Math.max(...activeResults.map((k) => k.cpc)).toFixed(2)}
              </div>
              <div className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>Max CPC</div>
            </div>
          </div>

          {/* AI Analysis */}
          {activeAnalysis && (
            <div className="stat-card mb-6" style={{ borderLeft: "3px solid var(--accent)" }}>
              <h3 className="text-lg font-extrabold mb-3 flex items-center gap-2">
                <Brain size={20} style={{ color: "var(--accent)" }} />
                AI Strategic Analysis
              </h3>
              <div
                className="prose prose-sm max-w-none"
                style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(activeAnalysis) }}
              />
            </div>
          )}

          {/* Keywords Table */}
          <div className="stat-card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <BarChart3 size={18} style={{ color: "var(--accent)" }} />
                Keyword Results
              </h3>
              <div className="flex gap-1">
                {(["volume", "competition", "cpc"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className="px-3 py-1 rounded-md text-xs font-bold transition-all"
                    style={{
                      background: sortBy === s ? "var(--accent-muted)" : "transparent",
                      color: sortBy === s ? "var(--accent)" : "var(--text-muted)",
                    }}
                  >
                    {s === "volume" ? "Volume" : s === "competition" ? "Competition" : "CPC"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Keyword</th>
                    <th>Volume</th>
                    <th>Competition</th>
                    <th>CPC</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedResults.map((kw, i) => (
                    <tr key={kw.keyword}>
                      <td>
                        <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                      </td>
                      <td>
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                          {kw.keyword}
                        </span>
                      </td>
                      <td>
                        <span className="text-sm font-bold">{kw.searchVolume.toLocaleString()}</span>
                      </td>
                      <td>
                        <span
                          className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                          style={{ background: `${getCompetitionColor(kw.competition)}20`, color: getCompetitionColor(kw.competition) }}
                        >
                          {getCompetitionLabel(kw.competition)} ({kw.competition}%)
                        </span>
                      </td>
                      <td>
                        <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                          ${kw.cpc.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        {trackedKeywords.has(kw.keyword) ? (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-md" style={{ color: "#10B981" }}>
                            ✓ Tracked
                          </span>
                        ) : trackingInProgress.has(kw.keyword) ? (
                          <Loader2 size={12} className="animate-spin" style={{ color: "var(--accent)" }} />
                        ) : (
                          <button
                            onClick={async () => {
                              setTrackingInProgress((prev) => new Set([...prev, kw.keyword]));
                              try {
                                const res = await fetch(`/api/clients/${clientId}/keywords`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    keywords: [{
                                      keyword: kw.keyword,
                                      searchVolume: kw.searchVolume,
                                      difficulty: kw.competition,
                                      group: "Research",
                                    }],
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
                            }}
                            className="text-[10px] font-bold px-2 py-1 rounded-md transition-all hover:opacity-80"
                            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                            title="Add to tracked keywords"
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
        </>
      )}

      {/* Previous Sessions */}
      {sessions.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-extrabold mb-4 flex items-center gap-2">
            <Clock size={18} style={{ color: "var(--text-muted)" }} />
            Research History
          </h3>
          <div className="grid gap-3">
            {sessions.map((session) => (
              <div key={session.id} className="stat-card" style={{ padding: 0 }}>
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer transition-all hover:opacity-80"
                  onClick={() => {
                    if (expandedSession === session.id) {
                      setExpandedSession(null);
                    } else {
                      setExpandedSession(session.id);
                      setActiveResults(session.results);
                      setActiveAnalysis(session.aiAnalysis);
                    }
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Microscope size={14} style={{ color: "var(--accent)" }} />
                      <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        {session.seedTopics}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      <span className="flex items-center gap-1">
                        <Search size={10} /> {session.keywordsFound} keywords
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={10} /> {session.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {new Date(session.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleGenerateContentMap(session.id);
                      }}
                      disabled={isGeneratingMap}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: "rgba(139,92,246,0.15)", color: "#8b5cf6" }}
                    >
                      {isGeneratingMap ? (
                        <Loader2 size={12} className="animate-spin inline mr-1" />
                      ) : (
                        <Sparkles size={12} className="inline mr-1" />
                      )}
                      Generate Content Map
                    </button>
                    {expandedSession === session.id ? (
                      <ChevronUp size={16} style={{ color: "var(--text-muted)" }} />
                    ) : (
                      <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {sessions.length === 0 && activeResults.length === 0 && !isResearching && !showForm && (
        <div className="stat-card text-center py-16">
          <Microscope size={48} className="mx-auto mb-4" style={{ color: "var(--text-muted)", opacity: 0.5 }} />
          <h3 className="text-lg font-extrabold mb-2">No Keyword Research Yet</h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Start by entering seed topics to discover high-ROI keywords
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Search size={16} />
            Start Research
          </button>
        </div>
      )}
    </div>
  );
}

/** Simple Markdown → HTML converter */
function simpleMarkdownToHtml(md: string): string {
  let html = md
    .replace(/^#### (.+)$/gm, '<h4 style="font-size:14px;font-weight:800;margin:16px 0 6px;color:var(--text-primary)">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:800;margin:20px 0 8px;color:var(--text-primary)">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:800;margin:24px 0 10px;color:var(--text-primary)">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:800;margin:0 0 12px;color:var(--text-primary)">$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:20px;margin-bottom:4px">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:20px;margin-bottom:4px;list-style:decimal">$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent);padding-left:16px;margin:12px 0;color:var(--text-muted);font-style:italic">$1</blockquote>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border);margin:20px 0" />')
    .replace(/\n\n/g, '</p><p style="margin-bottom:12px">')
    .replace(/\n/g, '<br />');

  html = `<p style="margin-bottom:12px">${html}</p>`;
  return html;
}

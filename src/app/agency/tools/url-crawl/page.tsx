"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Globe,
  Play,
  Loader2,
  Download,
  Trash2,
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
} from "lucide-react";

interface UrlEntry {
  url: string;
  statusCode: number | null;
  title: string | null;
  description: string | null;
  wordCount: number;
}

interface CrawlRecord {
  id: string;
  domain: string;
  label: string | null;
  status: string;
  pagesCount: number;
  maxPages: number;
  createdAt: string;
  client?: { name: string } | null;
  urls?: UrlEntry[];
}

export default function UrlCrawlPage() {
  const [crawls, setCrawls] = useState<CrawlRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // New crawl form
  const [domain, setDomain] = useState("");
  const [maxPages, setMaxPages] = useState(500);
  const [label, setLabel] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  // Detail view
  const [selectedCrawl, setSelectedCrawl] = useState<CrawlRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [urlFilter, setUrlFilter] = useState("");

  // Polling
  const [pollingIds, setPollingIds] = useState<Set<string>>(new Set());

  const loadCrawls = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/url-crawl");
      if (res.ok) {
        const data = await res.json();
        setCrawls(data);
        // Find any crawling items
        const crawling = data.filter((c: CrawlRecord) => c.status === "CRAWLING");
        setPollingIds(new Set(crawling.map((c: CrawlRecord) => c.id)));
      }
    } catch {
      /* */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCrawls();
  }, [loadCrawls]);

  // Poll crawling items
  useEffect(() => {
    if (pollingIds.size === 0) return;

    const interval = setInterval(async () => {
      for (const id of pollingIds) {
        try {
          const res = await fetch(`/api/tools/url-crawl/${id}`, { method: "POST" });
          if (res.ok) {
            const data = await res.json();
            if (data.status === "COMPLETED") {
              setPollingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              loadCrawls();
            } else {
              // Update page count in list
              setCrawls((prev) =>
                prev.map((c) =>
                  c.id === id ? { ...c, pagesCount: data.pagesCrawled || c.pagesCount } : c
                )
              );
            }
          }
        } catch {
          /* */
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pollingIds, loadCrawls]);

  const handleStartCrawl = async () => {
    if (!domain.trim()) return;
    setIsStarting(true);
    setError("");

    try {
      const res = await fetch("/api/tools/url-crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          maxPages,
          label: label.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to start crawl");
        setIsStarting(false);
        return;
      }

      // Reset form and refresh
      setDomain("");
      setLabel("");
      setMaxPages(500);
      await loadCrawls();
    } catch {
      setError("Network error");
    } finally {
      setIsStarting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this crawl?")) return;
    try {
      await fetch(`/api/tools/url-crawl/${id}`, { method: "DELETE" });
      setCrawls((prev) => prev.filter((c) => c.id !== id));
      if (selectedCrawl?.id === id) setSelectedCrawl(null);
    } catch {
      /* */
    }
  };

  const handleViewDetail = async (crawl: CrawlRecord) => {
    setLoadingDetail(true);
    setUrlFilter("");
    try {
      const res = await fetch(`/api/tools/url-crawl/${crawl.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedCrawl(data);
      }
    } catch {
      /* */
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredUrls = (selectedCrawl?.urls || []).filter((u) =>
    urlFilter
      ? u.url.toLowerCase().includes(urlFilter.toLowerCase()) ||
        (u.title || "").toLowerCase().includes(urlFilter.toLowerCase())
      : true
  );

  // ─── Detail View ───
  if (selectedCrawl) {
    return (
      <div>
        <button
          onClick={() => setSelectedCrawl(null)}
          className="flex items-center gap-1 text-sm font-semibold mb-4 hover:opacity-80 transition-opacity"
          style={{ color: "var(--accent)" }}
        >
          <ArrowLeft size={16} /> Back to Crawls
        </button>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>
              {selectedCrawl.label || selectedCrawl.domain}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {selectedCrawl.domain} · {selectedCrawl.pagesCount} pages ·{" "}
              {new Date(selectedCrawl.createdAt).toLocaleDateString()}
            </p>
          </div>
          <a
            href={`/api/tools/url-crawl/${selectedCrawl.id}/export`}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
          >
            <Download size={16} /> Export CSV
          </a>
        </div>

        {/* Filter */}
        <div className="relative mb-4">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            className="input-field pl-9"
            placeholder="Filter URLs by path or title..."
            value={urlFilter}
            onChange={(e) => setUrlFilter(e.target.value)}
          />
          {urlFilter && (
            <button
              onClick={() => setUrlFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* URL Table */}
        {loadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : (
          <div className="card overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      #
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      URL
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-bold text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Title
                    </th>
                    <th className="text-right px-4 py-3 font-bold text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      Words
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUrls.map((u, i) => (
                    <tr
                      key={u.url}
                      style={{ borderBottom: "1px solid var(--border)" }}
                      className="hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                        {i + 1}
                      </td>
                      <td className="px-4 py-2.5 max-w-md">
                        <a
                          href={u.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium hover:underline truncate block flex items-center gap-1"
                          style={{ color: "var(--accent)" }}
                        >
                          {u.url.replace(/^https?:\/\/[^/]+/, "")}
                          <ExternalLink size={10} className="flex-shrink-0 opacity-50" />
                        </a>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-md"
                          style={{
                            background:
                              u.statusCode === 200
                                ? "rgba(34,197,94,0.15)"
                                : u.statusCode && u.statusCode >= 300 && u.statusCode < 400
                                ? "rgba(245,158,11,0.15)"
                                : "rgba(239,68,68,0.15)",
                            color:
                              u.statusCode === 200
                                ? "#22c55e"
                                : u.statusCode && u.statusCode >= 300 && u.statusCode < 400
                                ? "#f59e0b"
                                : "#ef4444",
                          }}
                        >
                          {u.statusCode || "?"}
                        </span>
                      </td>
                      <td
                        className="px-4 py-2.5 text-sm truncate max-w-xs"
                        style={{ color: "var(--text-secondary)" }}
                        title={u.title || ""}
                      >
                        {u.title || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                        {u.wordCount > 0 ? u.wordCount.toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUrls.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {urlFilter ? "No URLs match your filter" : "No URLs found"}
                </p>
              </div>
            )}
          </div>
        )}

        <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
          Showing {filteredUrls.length} of {selectedCrawl.urls?.length || 0} URLs
        </p>
      </div>
    );
  }

  // ─── Main View ───
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/agency/tools"
          className="flex items-center gap-1 text-sm font-semibold hover:opacity-80 transition-opacity"
          style={{ color: "var(--accent)" }}
        >
          <ArrowLeft size={16} /> Tools
        </Link>
      </div>

      <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
        <Globe size={24} className="inline mr-2" style={{ color: "var(--accent)" }} />
        URL Crawl
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Crawl any domain to discover all pages. Export the URL list for domain migration redirect mappings.
      </p>

      {/* New Crawl Form */}
      <div
        className="card p-5 mb-6"
        style={{ border: "1px solid var(--border)" }}
      >
        <h2 className="text-sm font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Start New Crawl
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label
              className="text-xs font-bold uppercase tracking-wide mb-1.5 block"
              style={{ color: "var(--text-muted)" }}
            >
              Domain
            </label>
            <input
              className="input-field"
              placeholder="e.g. example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div>
            <label
              className="text-xs font-bold uppercase tracking-wide mb-1.5 block"
              style={{ color: "var(--text-muted)" }}
            >
              Label (optional)
            </label>
            <input
              className="input-field"
              placeholder='e.g. "Old site"'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <label
              className="text-xs font-bold uppercase tracking-wide mb-1.5 block"
              style={{ color: "var(--text-muted)" }}
            >
              Max Pages ({maxPages})
            </label>
            <input
              type="range"
              min={50}
              max={2000}
              step={50}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className="w-full mt-2"
              style={{ accentColor: "var(--accent)" }}
            />
            <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              <span>50</span>
              <span>2,000</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: "#ef4444" }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button
          onClick={handleStartCrawl}
          disabled={!domain.trim() || isStarting}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold mt-4"
          style={{ opacity: !domain.trim() || isStarting ? 0.5 : 1 }}
        >
          {isStarting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Starting...
            </>
          ) : (
            <>
              <Play size={16} /> Start Crawl
            </>
          )}
        </button>
      </div>

      {/* Crawl History */}
      <h2 className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>
        Crawl History
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : crawls.length === 0 ? (
        <div
          className="card p-8 text-center"
          style={{ border: "1px solid var(--border)" }}
        >
          <Globe size={32} className="mx-auto mb-3 opacity-40" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No crawls yet. Start one above!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {crawls.map((crawl) => (
            <div
              key={crawl.id}
              className="card p-4 flex items-center gap-4"
              style={{ border: "1px solid var(--border)" }}
            >
              {/* Status icon */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background:
                    crawl.status === "COMPLETED"
                      ? "rgba(34,197,94,0.15)"
                      : crawl.status === "CRAWLING"
                      ? "rgba(59,130,246,0.15)"
                      : "rgba(239,68,68,0.15)",
                }}
              >
                {crawl.status === "COMPLETED" ? (
                  <CheckCircle2 size={18} style={{ color: "#22c55e" }} />
                ) : crawl.status === "CRAWLING" ? (
                  <Loader2 size={18} className="animate-spin" style={{ color: "#3b82f6" }} />
                ) : (
                  <AlertCircle size={18} style={{ color: "#ef4444" }} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                  {crawl.label || crawl.domain}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {crawl.domain} · {crawl.pagesCount} pages · {new Date(crawl.createdAt).toLocaleDateString()}
                  {crawl.client && ` · ${crawl.client.name}`}
                </p>
              </div>

              {/* Status badge */}
              <span
                className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md flex-shrink-0"
                style={{
                  background:
                    crawl.status === "COMPLETED"
                      ? "rgba(34,197,94,0.15)"
                      : crawl.status === "CRAWLING"
                      ? "rgba(59,130,246,0.15)"
                      : "rgba(239,68,68,0.15)",
                  color:
                    crawl.status === "COMPLETED"
                      ? "#22c55e"
                      : crawl.status === "CRAWLING"
                      ? "#3b82f6"
                      : "#ef4444",
                }}
              >
                {crawl.status === "CRAWLING"
                  ? `Crawling... ${crawl.pagesCount} pages`
                  : crawl.status}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {crawl.status === "COMPLETED" && (
                  <>
                    <button
                      onClick={() => handleViewDetail(crawl)}
                      className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                      title="View URLs"
                    >
                      <Search size={16} style={{ color: "var(--text-muted)" }} />
                    </button>
                    <a
                      href={`/api/tools/url-crawl/${crawl.id}/export`}
                      className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                      title="Export CSV"
                    >
                      <Download size={16} style={{ color: "var(--text-muted)" }} />
                    </a>
                  </>
                )}
                <button
                  onClick={() => handleDelete(crawl.id)}
                  className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} style={{ color: "var(--text-muted)" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

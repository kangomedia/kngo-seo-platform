"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Library as LibraryIcon,
  ExternalLink,
  Copy,
  Check,
  Search,
  FileText,
  MapPin,
  Megaphone,
  HelpCircle,
} from "lucide-react";
import { getClientPublishedContent } from "@/lib/actions-public";

interface PublishedPiece {
  id: string;
  type: string;
  title: string;
  keyword: string | null;
  slug: string | null;
  publishedUrl: string;
  publishedAt: string | null;
  metaDescription: string | null;
  socialPosts: {
    twitter?: string;
    linkedin?: string;
    facebook?: string;
    instagram?: string;
  } | null;
}

const TYPE_META: Record<string, { label: string; emoji: string; icon: React.ReactNode; color: string }> = {
  BLOG_POST: { label: "Blog Post", emoji: "✍️", icon: <FileText size={14} />, color: "#3B82F6" },
  GBP_POST: { label: "Google Business Post", emoji: "📍", icon: <MapPin size={14} />, color: "#10B981" },
  GBP_QA: { label: "Google Q&A", emoji: "❓", icon: <HelpCircle size={14} />, color: "#06B6D4" },
  PRESS_RELEASE: { label: "Press Release", emoji: "📢", icon: <Megaphone size={14} />, color: "#8B5CF6" },
};

const PLATFORMS: Array<{ key: "twitter" | "linkedin" | "facebook" | "instagram"; label: string; icon: string }> = [
  { key: "twitter", label: "Twitter / X", icon: "𝕏" },
  { key: "linkedin", label: "LinkedIn", icon: "in" },
  { key: "facebook", label: "Facebook", icon: "f" },
  { key: "instagram", label: "Instagram", icon: "◎" },
];

export default function ClientLibraryPage() {
  const params = useParams();
  const token = params.token as string;
  const [pieces, setPieces] = useState<PublishedPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Per-(piece+platform) "Copied!" indicator; clears after a short timeout.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await getClientPublishedContent(token);
      if (cancelled) return;
      if (data) setPieces(data.pieces as PublishedPiece[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Filter pieces by type and free-text query (matches title or keyword).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pieces.filter((p) => {
      if (typeFilter !== "ALL" && p.type !== typeFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.keyword || "").toLowerCase().includes(q)
      );
    });
  }, [pieces, query, typeFilter]);

  // Counts per type for the filter pills.
  const counts = useMemo(() => {
    const out: Record<string, number> = { ALL: pieces.length };
    for (const p of pieces) {
      out[p.type] = (out[p.type] || 0) + 1;
    }
    return out;
  }, [pieces]);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 1500);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div
            className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3"
            style={{ borderColor: "#E34234", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "#888" }}>
            Loading your content library…
          </p>
        </div>
      </div>
    );
  }

  if (pieces.length === 0) {
    return (
      <div className="text-center py-16">
        <LibraryIcon size={40} className="mx-auto mb-4" style={{ color: "#ccc" }} />
        <h2 className="text-lg font-bold mb-2" style={{ color: "#222" }}>
          Your content library is empty for now
        </h2>
        <p className="text-sm" style={{ color: "#888", maxWidth: 480, margin: "0 auto" }}>
          As we publish blog posts, Google Business Profile updates, and press releases on
          your behalf, they&apos;ll show up here — with one-click social copy you can paste
          straight into LinkedIn, Facebook, X, or Instagram.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold mb-1" style={{ color: "#222" }}>
          <LibraryIcon size={22} className="inline-block mr-2 mb-1" style={{ color: "#E34234" }} />
          Your Content Library
        </h1>
        <p className="text-sm" style={{ color: "#666" }}>
          Every piece we&apos;ve published for you. Click any card to see the social-media copy
          we&apos;ve already written for you — paste it straight into your own LinkedIn,
          Facebook, X, or Instagram to drive more eyes to the post.
        </p>
      </div>

      {/* Search + type filters */}
      <div
        className="rounded-2xl p-4 mb-5"
        style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Search size={16} style={{ color: "#888" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or keyword…"
            className="flex-1 text-sm bg-transparent outline-none"
            style={{ color: "#222" }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(["ALL", "BLOG_POST", "GBP_POST", "GBP_QA", "PRESS_RELEASE"] as const).map((t) => {
            const active = typeFilter === t;
            const label = t === "ALL" ? "All" : TYPE_META[t]?.label || t;
            const count = counts[t] || 0;
            if (t !== "ALL" && count === 0) return null;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="px-3 py-1 rounded-full text-xs font-bold transition-all"
                style={{
                  background: active ? "#fff0ef" : "#F5F5F5",
                  color: active ? "#E34234" : "#666",
                  border: `1px solid ${active ? "#E34234" : "#E4E4E4"}`,
                }}
              >
                {label} <span style={{ opacity: 0.6, marginLeft: 4 }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pieces */}
      <div className="flex flex-col gap-3">
        {visible.length === 0 && (
          <p className="text-sm text-center py-12" style={{ color: "#888" }}>
            No matches for that filter.
          </p>
        )}
        {visible.map((piece) => {
          const meta = TYPE_META[piece.type] || TYPE_META.BLOG_POST;
          const isExpanded = expandedId === piece.id;
          const hasSocial = piece.socialPosts && PLATFORMS.some((p) => piece.socialPosts![p.key]);
          return (
            <div
              key={piece.id}
              className="rounded-2xl overflow-hidden"
              style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide"
                      style={{ background: `${meta.color}15`, color: meta.color }}
                    >
                      {meta.icon} {meta.label}
                    </span>
                    {piece.publishedAt && (
                      <span className="text-xs" style={{ color: "#888" }}>
                        Published {new Date(piece.publishedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                  <a
                    href={piece.publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{
                      background: "#fff0ef",
                      color: "#E34234",
                      border: "1px solid #E34234",
                    }}
                  >
                    <ExternalLink size={12} /> View live
                  </a>
                </div>

                <a
                  href={piece.publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-base font-extrabold leading-snug mb-2"
                  style={{ color: "#222", textDecoration: "none" }}
                >
                  {piece.title}
                </a>

                {piece.keyword && (
                  <p className="text-xs mb-2" style={{ color: "#888" }}>
                    🎯 Target keyword: <span style={{ color: "#444" }}>{piece.keyword}</span>
                  </p>
                )}

                {piece.metaDescription && (
                  <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
                    {piece.metaDescription}
                  </p>
                )}

                {hasSocial && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : piece.id)}
                    className="mt-3 text-xs font-bold inline-flex items-center gap-1"
                    style={{ color: "#E34234" }}
                  >
                    {isExpanded ? "Hide" : "Show"} share-ready social copy
                  </button>
                )}
              </div>

              {isExpanded && hasSocial && (
                <div
                  className="px-5 py-4"
                  style={{ background: "#FAFAFA", borderTop: "1px solid #E4E4E4" }}
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-widest mb-3" style={{ color: "#888" }}>
                    Pre-written social posts — click Copy and paste straight into your account
                  </p>
                  <div className="flex flex-col gap-3">
                    {PLATFORMS.map((platform) => {
                      const text = piece.socialPosts?.[platform.key];
                      if (!text) return null;
                      const key = `${piece.id}-${platform.key}`;
                      const copied = copiedKey === key;
                      // We append the live URL to the copy payload so the
                      // client can paste straight into a social tool and
                      // the URL is included automatically.
                      const payload = `${text}\n\n${piece.publishedUrl}`;
                      return (
                        <div
                          key={platform.key}
                          className="rounded-lg p-3"
                          style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-extrabold" style={{ color: "#222" }}>
                              <span
                                className="inline-block w-5 h-5 rounded text-center text-[10px] font-extrabold mr-2"
                                style={{
                                  background: "#222",
                                  color: "#fff",
                                  lineHeight: "20px",
                                }}
                              >
                                {platform.icon}
                              </span>
                              {platform.label}
                            </span>
                            <button
                              onClick={() => copy(key, payload)}
                              className="text-xs font-bold px-3 py-1 rounded-lg inline-flex items-center gap-1"
                              style={{
                                background: copied ? "#dcfce7" : "#fff0ef",
                                color: copied ? "#16a34a" : "#E34234",
                                border: `1px solid ${copied ? "#86efac" : "#E34234"}`,
                              }}
                            >
                              {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy with link</>}
                            </button>
                          </div>
                          <p
                            className="text-sm whitespace-pre-line"
                            style={{ color: "#444", lineHeight: 1.55 }}
                          >
                            {text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

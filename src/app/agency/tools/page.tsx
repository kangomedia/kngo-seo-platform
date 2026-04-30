"use client";

import Link from "next/link";
import { Globe, ArrowRight } from "lucide-react";

export default function ToolsPage() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1" style={{ color: "var(--text-primary)" }}>
        🧰 Tools
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
        Standalone utilities for SEO projects
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* URL Crawl Tool */}
        <Link
          href="/agency/tools/url-crawl"
          className="card p-6 hover:border-[var(--accent)] transition-all group"
          style={{ border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--accent-muted)" }}
            >
              <Globe size={20} style={{ color: "var(--accent)" }} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              URL Crawl
            </h2>
          </div>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Crawl any domain to discover all pages. Export the full URL list as CSV — perfect for
            domain migration redirect mappings.
          </p>
          <div
            className="flex items-center gap-1 text-xs font-bold group-hover:gap-2 transition-all"
            style={{ color: "var(--accent)" }}
          >
            Open Tool <ArrowRight size={14} />
          </div>
        </Link>
      </div>
    </div>
  );
}

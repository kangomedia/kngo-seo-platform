"use client";

import { FileBarChart, ExternalLink, Plus, Calendar } from "lucide-react";

const mockReports = [
  { id: "rpt-1", title: "March 2026 SEO Report", month: 3, year: 2026, published: true, uuid: "abc123" },
  { id: "rpt-2", title: "February 2026 SEO Report", month: 2, year: 2026, published: true, uuid: "def456" },
  { id: "rpt-3", title: "January 2026 SEO Report", month: 1, year: 2026, published: true, uuid: "ghi789" },
];

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ReportsPage() {
  return (
    <div className="max-w-4xl stagger">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-extrabold">Monthly Reports</h2>
        <button className="btn-primary text-sm">
          <Plus size={16} />
          Generate Report
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {mockReports.map((report) => (
          <div key={report.id} className="stat-card flex items-center gap-4" style={{ padding: "16px 20px" }}>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
            >
              <FileBarChart size={22} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                {report.title}
              </h4>
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <Calendar size={11} />
                {months[report.month - 1]} {report.year}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {report.published && (
                <span className="status-badge status-published">Published</span>
              )}
              <a
                href={`/report/${report.uuid}`}
                target="_blank"
                className="btn-secondary text-xs"
                style={{ padding: "6px 12px" }}
              >
                <ExternalLink size={12} />
                View
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

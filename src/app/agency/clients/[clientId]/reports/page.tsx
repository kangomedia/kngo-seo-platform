"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  FileBarChart,
  ExternalLink,
  Plus,
  Calendar,
  Loader2,
} from "lucide-react";

interface Report {
  id: string;
  title: string;
  summary: string;
  month: number;
  year: number;
  isPublished: boolean;
  createdAt: string;
}

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function ReportsPage() {
  const params = useParams();
  const clientId = params.clientId as string;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetch(`/api/clients/${clientId}/reports`)
      .then((r) => r.json())
      .then((data) => {
        setReports(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const newReport = await res.json();
        setReports((prev) => [newReport, ...prev]);
      }
    } catch {
      // Handle silently
    } finally {
      setIsGenerating(false);
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

  return (
    <div className="max-w-4xl stagger">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-extrabold">Monthly Reports</h2>
        <button
          className="btn-primary text-sm"
          onClick={handleGenerateReport}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Plus size={16} />
              Generate Report
            </>
          )}
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="stat-card text-center py-12">
          <FileBarChart
            size={40}
            style={{ color: "var(--text-muted)" }}
            className="mx-auto mb-4"
          />
          <p className="text-lg font-bold mb-2">No reports yet</p>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Click &quot;Generate Report&quot; to create a summary for the
            current month
          </p>
          <button
            className="btn-primary"
            onClick={handleGenerateReport}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Generate Report
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="stat-card flex items-center gap-4"
              style={{ padding: "16px 20px" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                }}
              >
                <FileBarChart size={22} />
              </div>
              <div className="flex-1">
                <h4
                  className="text-sm font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {report.title}
                </h4>
                <p
                  className="text-xs flex items-center gap-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Calendar size={11} />
                  {months[report.month - 1]} {report.year}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {report.isPublished && (
                  <span className="status-badge status-published">
                    Published
                  </span>
                )}
                <a
                  href={`/report/${report.id}`}
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
      )}
    </div>
  );
}

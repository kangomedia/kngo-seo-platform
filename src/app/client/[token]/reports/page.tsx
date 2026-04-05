"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getClientReports } from "@/lib/actions-public";
import { FileBarChart, ExternalLink, Calendar } from "lucide-react";

interface Report {
  id: string;
  title: string;
  month: number;
  year: number;
  uuid: string;
  summary: string | null;
}

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ClientReportsPage() {
  const params = useParams();
  const token = params.token as string;
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getClientReports(token);
      if (data) {
        setReports(data.reports as unknown as Report[]);
      }
      setLoading(false);
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "#E34234", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "#888" }}>Loading reports...</p>
        </div>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-16">
        <FileBarChart size={40} className="mx-auto mb-4" style={{ color: "#ccc" }} />
        <h2 className="text-lg font-bold mb-2" style={{ color: "#222" }}>No Reports Yet</h2>
        <p className="text-sm" style={{ color: "#888" }}>
          Monthly SEO reports will appear here once your first month is complete.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-2" style={{ color: "#222" }}>
        Your Reports
      </h1>
      <p className="text-sm mb-6" style={{ color: "#888" }}>
        Monthly progress reports from our team
      </p>

      <div className="flex flex-col gap-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="p-5 rounded-2xl"
            style={{ background: "#FFFFFF", border: "1px solid #E4E4E4" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "#fff0ef", color: "#E34234" }}
              >
                <FileBarChart size={22} />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold mb-1" style={{ color: "#222" }}>
                  {report.title}
                </h3>
                <p className="text-xs flex items-center gap-1 mb-2" style={{ color: "#888" }}>
                  <Calendar size={11} />
                  {months[report.month - 1]} {report.year}
                </p>
                {report.summary && (
                  <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
                    {report.summary}
                  </p>
                )}
              </div>
              <a
                href={`/report/${report.uuid}`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all flex-shrink-0"
                style={{
                  background: "#fff0ef",
                  color: "#E34234",
                  border: "1px solid #E34234",
                }}
              >
                <ExternalLink size={14} />
                View Report
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

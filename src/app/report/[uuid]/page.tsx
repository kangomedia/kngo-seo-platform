"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, FileText } from "lucide-react";
import SiteAuditReport from "@/components/reports/SiteAuditReport";
import BaselineReport from "@/components/reports/BaselineReport";
import MonthlyReport from "@/components/reports/MonthlyReport";

interface Report {
  id: string;
  uuid: string;
  type: string;
  title: string;
  month: number;
  year: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export default function PublicReportPage() {
  const params = useParams();
  const uuid = params.uuid as string;
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/reports/${uuid}`)
      .then((r) => {
        if (!r.ok) throw new Error("Report not found");
        return r.json();
      })
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [uuid]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "100vh", background: "#F5F5F5" }}
      >
        <div className="text-center">
          <Loader2
            size={32}
            className="animate-spin mx-auto mb-4"
            style={{ color: "#E34234" }}
          />
          <p className="text-sm" style={{ color: "#888" }}>
            Loading report...
          </p>
        </div>
      </div>
    );
  }

  if (error || !report?.data) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: "100vh", background: "#F5F5F5" }}
      >
        <div className="text-center">
          <FileText
            size={48}
            className="mx-auto mb-4"
            style={{ color: "#ccc" }}
          />
          <h2 className="text-xl font-bold mb-2" style={{ color: "#222" }}>
            Report Not Found
          </h2>
          <p className="text-sm" style={{ color: "#888" }}>
            This report may not exist or has not been published yet.
          </p>
        </div>
      </div>
    );
  }

  // Route to the correct report layout based on type
  switch (report.type) {
    case "SITE_AUDIT":
      return <SiteAuditReport data={report.data} />;
    case "BASELINE":
      return <BaselineReport data={report.data} />;
    case "MONTHLY":
    default:
      return <MonthlyReport data={report.data} />;
  }
}

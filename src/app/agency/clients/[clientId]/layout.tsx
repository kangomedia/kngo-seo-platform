"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { clients } from "@/lib/mock-data";
import {
  LayoutDashboard,
  BarChart3,
  FileText,
  ListChecks,
  Shield,
  FileBarChart,
  ArrowLeft,
} from "lucide-react";

const subNav = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/rankings", label: "Rankings", icon: BarChart3 },
  { href: "/content", label: "Content Hub", icon: FileText },
  { href: "/deliverables", label: "Deliverables", icon: ListChecks },
  { href: "/reports", label: "Reports", icon: FileBarChart },
];

export default function ClientDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const clientId = params.clientId as string;
  const client = clients.find((c) => c.id === clientId);

  if (!client) {
    return (
      <div className="flex items-center justify-center h-96">
        <p style={{ color: "var(--text-muted)" }}>Client not found</p>
      </div>
    );
  }

  const basePath = `/agency/clients/${clientId}`;

  return (
    <div>
      {/* Client Header */}
      <div className="mb-6">
        <Link
          href="/agency/clients"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={14} />
          All Clients
        </Link>

        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-extrabold"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            {client.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">{client.name}</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {client.domain}
            </p>
          </div>
          <span
            className={`tier-badge ml-2 ${
              client.tier === "PRO"
                ? "tier-pro"
                : client.tier === "GROWTH"
                ? "tier-growth"
                : "tier-starter"
            }`}
          >
            {client.tier}
          </span>
        </div>
      </div>

      {/* Sub Navigation */}
      <div
        className="flex gap-1 mb-6 pb-0 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {subNav.map((item) => {
          const fullPath = `${basePath}${item.href}`;
          const isActive =
            item.href === ""
              ? pathname === basePath
              : pathname.startsWith(fullPath);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={fullPath}
              className="flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors relative"
              style={{
                color: isActive ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <Icon size={16} />
              {item.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ background: "var(--accent)" }}
                />
              )}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}

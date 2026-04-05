"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getClientByToken } from "@/lib/actions-public";
import {
  LayoutDashboard,
  FileText,
  FileBarChart,
} from "lucide-react";

const portalNav = [
  { href: "", label: "Dashboard", icon: LayoutDashboard },
  { href: "/content", label: "Content Review", icon: FileText },
  { href: "/reports", label: "Reports", icon: FileBarChart },
];

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const token = params.token as string;
  const [clientName, setClientName] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getClientByToken(token).then((client) => {
      if (client) {
        setClientName(client.name);
      } else {
        setNotFound(true);
      }
    });
  }, [token]);

  const basePath = `/client/${token}`;

  if (notFound) {
    return (
      <div
        className="flex flex-col items-center justify-center h-screen"
        style={{ background: "#F5F5F5" }}
      >
        <p className="text-6xl mb-4">🔒</p>
        <h1 className="text-xl font-bold mb-2" style={{ color: "#222" }}>
          Link Not Found
        </h1>
        <p className="text-sm" style={{ color: "#888" }}>
          This link may have expired or is invalid. Please contact your SEO team.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "#F5F5F5", color: "#222222", minHeight: "100vh" }}>
      {/* Top Navigation */}
      <header
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #E4E4E4",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo + Client Name */}
          <div className="flex items-center gap-4">
            <img
              src="/brand/logo-default.svg"
              alt="KangoMedia"
              className="h-6 w-auto"
            />
            <div
              style={{ width: 1, height: 24, background: "#E4E4E4" }}
            />
            <span className="text-sm font-bold" style={{ color: "#222" }}>
              {clientName || "Loading..."}
            </span>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-1">
            {portalNav.map((item) => {
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
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{
                    background: isActive ? "#fff0ef" : "transparent",
                    color: isActive ? "#E34234" : "#888888",
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>

      {/* Footer */}
      <footer className="text-center py-6" style={{ borderTop: "1px solid #E4E4E4" }}>
        <p className="text-xs" style={{ color: "#888" }}>
          Powered by{" "}
          <a href="https://kangomedia.com" className="font-bold" style={{ color: "#E34234" }}>
            KangoMedia
          </a>
        </p>
      </footer>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  ListChecks,
  Settings,
  LogOut,
  ChevronRight,
  Kanban,
  Wrench,
} from "lucide-react";

const navItems = [
  { href: "/agency/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agency/clients", label: "Clients", icon: Users },
  { href: "/agency/content-queue", label: "Content Queue", icon: Kanban },
  { href: "/agency/deliverables", label: "Deliverables", icon: ListChecks },
  { href: "/agency/tools", label: "Tools", icon: Wrench },
  { href: "/agency/settings", label: "Settings", icon: Settings },
];

export default function AgencyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Determine active section for breadcrumb
  const activeNav = navItems.find((item) => pathname.startsWith(item.href));
  const isClientDetail = pathname.includes("/agency/clients/cl-");
  const clientSlug = isClientDetail
    ? pathname.split("/agency/clients/")[1]?.split("/")[0]
    : null;

  // User initials and display
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User";
  const userInitials = userName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
  const userRole = session?.user?.role === "AGENCY_ADMIN" ? "Admin" : session?.user?.role === "AGENCY_MEMBER" ? "Member" : "User";

  return (
    <div className="dark flex min-h-screen" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Sidebar */}
      <aside
        className="fixed left-0 top-0 bottom-0 w-[240px] flex flex-col z-50"
        style={{
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <img
            src="/brand/logo-white.svg"
            alt="KangoMedia"
            className="h-7 w-auto"
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className="sidebar-link" style={isActive ? { background: "var(--accent-muted)", color: "var(--accent)" } : {}}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer — User Profile + Logout */}
        <div className="px-3 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{userName}</p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{userRole}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="sidebar-link w-full text-left"
            style={{ color: "var(--text-muted)" }}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-[240px] flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header
          className="sticky top-0 z-40 h-14 flex items-center px-6 gap-2"
          style={{
            background: "rgba(11, 14, 20, 0.8)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {activeNav && (
            <>
              <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                {activeNav.label}
              </span>
              {isClientDetail && clientSlug && (
                <>
                  <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Client Detail
                  </span>
                </>
              )}
            </>
          )}
        </header>

        {/* Page content */}
        <div className="flex-1 p-6">{children}</div>
      </main>
    </div>
  );
}


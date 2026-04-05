import Link from "next/link";

export default function HomePage() {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0B0E14, #1A1F2E)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        textAlign: "center",
        color: "#F1F5F9",
      }}
    >
      {/* Logo */}
      <img
        src="/brand/logo-white.svg"
        alt="KangoMedia"
        style={{ height: 32, marginBottom: 48 }}
      />

      {/* Hero */}
      <h1
        style={{
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          fontWeight: 900,
          letterSpacing: "-0.03em",
          lineHeight: 1.1,
          marginBottom: 16,
          maxWidth: 600,
        }}
      >
        KNGO SEO
        <br />
        <span style={{ color: "#E34234" }}>Platform</span>
      </h1>

      <p
        style={{
          fontSize: 16,
          color: "#94A3B8",
          maxWidth: 440,
          marginBottom: 40,
          lineHeight: 1.6,
        }}
      >
        Multi-client SEO management. Rank tracking, AI-powered content,
        deliverable tracking, and client reporting — all in one place.
      </p>

      {/* Portal Links */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <Link
          href="/agency/dashboard"
          className="btn-primary"
          style={{ padding: "14px 32px", fontSize: 15, borderRadius: 14 }}
        >
          Agency Portal →
        </Link>

        <Link
          href="/client/cl-mission-ac"
          className="btn-secondary"
          style={{
            padding: "14px 32px",
            fontSize: 15,
            borderRadius: 14,
            color: "#94A3B8",
            borderColor: "#232939",
          }}
        >
          Client Portal (Demo) →
        </Link>
      </div>

      {/* Build Info */}
      <p
        style={{
          position: "fixed",
          bottom: 24,
          fontSize: 11,
          color: "#64748B",
          fontWeight: 600,
        }}
      >
        Built by KangoMedia · v0.2.0
      </p>
    </div>
  );
}

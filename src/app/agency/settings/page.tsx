"use client";

import { useState, useEffect } from "react";
import { Save, Database, Globe, Wand2, CheckCircle2, XCircle, Loader2, Key } from "lucide-react";

interface SettingsData {
  agencyName: string;
  logoUrl: string;
  hasDataForSEO: boolean;
  hasClaude: boolean;
  hasGHL: boolean;
}

function ConnectionBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full"
      style={{
        background: connected ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
        color: connected ? "#10B981" : "#EF4444",
      }}
    >
      {connected ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {connected ? "Set via Environment" : "Not configured"}
    </span>
  );
}

function ConnectionCard({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  envVars,
  connected,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  envVars: string[];
  connected: boolean;
}) {
  return (
    <div className="stat-card mb-6" style={{ padding: 24 }}>
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{description}</p>
        </div>
        <ConnectionBadge connected={connected} />
      </div>
      <div
        className="rounded-lg px-3 py-2 text-[11px] font-mono"
        style={{ background: "var(--bg-secondary)", color: "var(--text-muted)" }}
      >
        {envVars.map((v) => (
          <div key={v}>{v}</div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsData | null>(null);

  // Form state — only agency profile is editable
  const [agencyName, setAgencyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setAgencyName(data.agencyName || "");
        setLogoUrl(data.logoUrl || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyName, logoUrl }),
      });
      const data = await res.json();
      setSettings((prev) => (prev ? { ...prev, ...data } : prev));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto stagger">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-1">Settings</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Manage your agency profile. API credentials are managed via environment variables.
        </p>
      </div>

      {/* Agency Profile */}
      <div className="stat-card mb-6" style={{ padding: 24 }}>
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            <Globe size={20} />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Agency Profile</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Your agency branding and information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Agency Name
            </label>
            <input className="input-field" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Logo URL
            </label>
            <input className="input-field" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end mt-5">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saved ? "Saved ✓" : saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>

      {/* API Connections — read-only status */}
      <div className="mb-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
          API Connections
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          All API credentials are loaded from environment variables. To change them, update your environment
          configuration (Coolify → Environment Variables) and redeploy.
        </p>
      </div>

      <ConnectionCard
        icon={<Database size={20} />}
        iconBg="rgba(59, 130, 246, 0.12)"
        iconColor="#3B82F6"
        title="DataForSEO"
        description="Rank tracking, keyword research & SERP data"
        envVars={["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"]}
        connected={settings?.hasDataForSEO || false}
      />

      <ConnectionCard
        icon={<Wand2 size={20} />}
        iconBg="rgba(139, 92, 246, 0.12)"
        iconColor="#8B5CF6"
        title="Claude AI (Anthropic)"
        description="Content generation, topical maps & optimization"
        envVars={["ANTHROPIC_API_KEY"]}
        connected={settings?.hasClaude || false}
      />

      <ConnectionCard
        icon={<Key size={20} />}
        iconBg="rgba(16, 185, 129, 0.12)"
        iconColor="#10B981"
        title="GoHighLevel"
        description="CRM integration for reviews & lead attribution"
        envVars={["GHL_API_KEY", "GHL_LOCATION_ID"]}
        connected={settings?.hasGHL || false}
      />
    </div>
  );
}

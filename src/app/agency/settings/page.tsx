"use client";

import { useState, useEffect } from "react";
import { Save, Eye, EyeOff, Key, Database, Globe, Wand2, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface SettingsData {
  agencyName: string;
  logoUrl: string;
  dataforseoLogin: string;
  dataforseoPwd: string;
  claudeApiKey: string;
  ghlApiKey: string;
  ghlLocationId: string;
  hasDataForSEO: boolean;
  hasClaude: boolean;
  hasGHL: boolean;
  dataforseoSource: string | null;
  claudeSource: string | null;
  ghlSource: string | null;
}

function ConnectionBadge({ connected, source }: { connected: boolean; source?: string | null }) {
  const label = connected
    ? source === "env" ? "Via Environment" : "Connected"
    : "Not configured";
  return (
    <span
      className="flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full"
      style={{
        background: connected ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
        color: connected ? "#10B981" : "#EF4444",
      }}
    >
      {connected ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {label}
    </span>
  );
}

export default function SettingsPage() {
  const [showDataForSEO, setShowDataForSEO] = useState(false);
  const [showClaude, setShowClaude] = useState(false);
  const [showGHL, setShowGHL] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsData | null>(null);

  // Form state
  const [agencyName, setAgencyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [dataforseoLogin, setDataforseoLogin] = useState("");
  const [dataforseoPwd, setDataforseoPwd] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [ghlApiKey, setGhlApiKey] = useState("");
  const [ghlLocationId, setGhlLocationId] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setAgencyName(data.agencyName || "");
        setLogoUrl(data.logoUrl || "");
        setDataforseoLogin(data.dataforseoLogin || "");
        setDataforseoPwd(data.dataforseoPwd || "");
        setClaudeApiKey(data.claudeApiKey || "");
        setGhlApiKey(data.ghlApiKey || "");
        setGhlLocationId(data.ghlLocationId || "");
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
        body: JSON.stringify({
          agencyName,
          logoUrl,
          dataforseoLogin,
          dataforseoPwd,
          claudeApiKey,
          ghlApiKey,
          ghlLocationId,
        }),
      });
      const data = await res.json();
      setSettings((prev) => prev ? { ...prev, ...data } : prev);
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
          Manage your agency profile and API connections
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
      </div>

      {/* DataForSEO */}
      <div className="stat-card mb-6" style={{ padding: 24 }}>
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3B82F6" }}
          >
            <Database size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">DataForSEO</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Rank tracking, keyword research & SERP data</p>
          </div>
          <ConnectionBadge connected={settings?.hasDataForSEO || false} source={settings?.dataforseoSource} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Login
            </label>
            <input className="input-field" value={dataforseoLogin} onChange={(e) => setDataforseoLogin(e.target.value)} placeholder="your-login@email.com" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Password
            </label>
            <div className="relative">
              <input
                className="input-field pr-10"
                type={showDataForSEO ? "text" : "password"}
                value={dataforseoPwd}
                onChange={(e) => setDataforseoPwd(e.target.value)}
                placeholder="••••••••••"
              />
              <button
                onClick={() => setShowDataForSEO(!showDataForSEO)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              >
                {showDataForSEO ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Claude API */}
      <div className="stat-card mb-6" style={{ padding: 24 }}>
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(139, 92, 246, 0.12)", color: "#8B5CF6" }}
          >
            <Wand2 size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">Claude AI (Anthropic)</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Content generation, topical maps & optimization</p>
          </div>
          <ConnectionBadge connected={settings?.hasClaude || false} source={settings?.claudeSource} />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
            API Key
          </label>
          <div className="relative">
            <input
              className="input-field pr-10"
              type={showClaude ? "text" : "password"}
              value={claudeApiKey}
              onChange={(e) => setClaudeApiKey(e.target.value)}
              placeholder="sk-ant-api..."
            />
            <button
              onClick={() => setShowClaude(!showClaude)}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            >
              {showClaude ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* GoHighLevel */}
      <div className="stat-card mb-6" style={{ padding: 24 }}>
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10B981" }}
          >
            <Key size={20} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold">GoHighLevel</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>CRM integration for reviews & lead attribution</p>
          </div>
          <ConnectionBadge connected={settings?.hasGHL || false} source={settings?.ghlSource} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              API Key
            </label>
            <div className="relative">
              <input
                className="input-field pr-10"
                type={showGHL ? "text" : "password"}
                value={ghlApiKey}
                onChange={(e) => setGhlApiKey(e.target.value)}
                placeholder="ghl-api-key..."
              />
              <button
                onClick={() => setShowGHL(!showGHL)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              >
                {showGHL ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Location ID
            </label>
            <input className="input-field" value={ghlLocationId} onChange={(e) => setGhlLocationId(e.target.value)} placeholder="location-id..." />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saved ? "Saved ✓" : saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

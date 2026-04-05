"use client";

import { useState } from "react";
import { Save, Eye, EyeOff, Key, Database, Globe, Wand2 } from "lucide-react";

export default function SettingsPage() {
  const [showDataForSEO, setShowDataForSEO] = useState(false);
  const [showClaude, setShowClaude] = useState(false);
  const [showGHL, setShowGHL] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
            <input className="input-field" defaultValue="KangoMedia" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Logo URL
            </label>
            <input className="input-field" defaultValue="/brand/logo-white.svg" />
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
          <div>
            <h2 className="text-lg font-extrabold">DataForSEO</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Rank tracking, keyword research & SERP data</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Login
            </label>
            <input className="input-field" placeholder="your-login@email.com" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Password
            </label>
            <div className="relative">
              <input
                className="input-field pr-10"
                type={showDataForSEO ? "text" : "password"}
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
          <div>
            <h2 className="text-lg font-extrabold">Claude AI (Anthropic)</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Content generation, topical maps & optimization</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
            API Key
          </label>
          <div className="relative">
            <input
              className="input-field pr-10"
              type={showClaude ? "text" : "password"}
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

      {/* GoHighLevel (Phase 2) */}
      <div className="stat-card mb-6" style={{ padding: 24, opacity: 0.6 }}>
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
          <span className="text-[10px] font-bold uppercase px-3 py-1 rounded-full" style={{ background: "var(--bg-card-hover)", color: "var(--text-muted)" }}>
            Phase 2
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              API Key
            </label>
            <input className="input-field" disabled placeholder="Coming in Phase 2..." />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
              Location ID
            </label>
            <input className="input-field" disabled placeholder="Coming in Phase 2..." />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary">
          <Save size={16} />
          {saved ? "Saved ✓" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

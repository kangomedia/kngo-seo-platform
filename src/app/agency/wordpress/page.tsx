"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Save, Trash2, Globe, Send } from "lucide-react";

type ClientLite = {
  id: string;
  name: string;
  domain: string | null;
};

type WPStatus = {
  wpUrl: string | null;
  wpUsername: string | null;
  configured: boolean;
};

type ApprovedPiece = {
  id: string;
  title: string;
  status: string;
  publishedUrl?: string | null;
};

export default function WordPressPage() {
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [status, setStatus] = useState<WPStatus | null>(null);
  const [approved, setApproved] = useState<ApprovedPiece[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Form
  const [wpUrl, setWpUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data: Array<ClientLite>) => {
        setClients(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setStatus(null);
    setApproved([]);
    fetch(`/api/clients/${selectedId}/wordpress`)
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        setWpUrl(data.wpUrl || "");
        setWpUsername(data.wpUsername || "");
        setWpAppPassword("");
      });
    // Approved + published pieces for this client (across all plans)
    fetch(`/api/content/queue?clientId=${selectedId}&status=APPROVED,PUBLISHED`)
      .then((r) => r.ok ? r.json() : { queue: [] })
      .then((data) => {
        const pieces: ApprovedPiece[] = (data.queue || []) as ApprovedPiece[];
        setApproved(pieces);
      })
      .catch(() => setApproved([]));
  }, [selectedId]);

  const selected = useMemo(() => clients.find((c) => c.id === selectedId), [clients, selectedId]);

  async function saveCredentials() {
    if (!selectedId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${selectedId}/wordpress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wpUrl, wpUsername, wpAppPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error || "Save failed" });
      } else {
        setStatus({ wpUrl, wpUsername, configured: true });
        setWpAppPassword("");
        setMessage({ kind: "ok", text: data.verifiedAs ? `Verified as ${data.verifiedAs}` : "Saved" });
      }
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Save failed — check console for details" });
    } finally {
      setBusy(false);
    }
  }

  async function clearCredentials() {
    if (!selectedId) return;
    if (!confirm("Remove WordPress credentials for this client?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${selectedId}/wordpress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wpUrl: "", wpUsername: "", wpAppPassword: "" }),
      });
      if (res.ok) {
        setStatus({ wpUrl: null, wpUsername: null, configured: false });
        setWpUrl("");
        setWpUsername("");
        setWpAppPassword("");
        setMessage({ kind: "ok", text: "Credentials removed" });
      } else {
        const data = await res.json();
        setMessage({ kind: "err", text: data.error || "Remove failed" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function publishPiece(pieceId: string, status: "draft" | "publish") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/content/pieces/${pieceId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: "err", text: data.error || "Publish failed" });
      } else {
        setMessage({ kind: "ok", text: `Published — ${data.url}` });
        setApproved((prev) => prev.map((p) => p.id === pieceId ? { ...p, status: "PUBLISHED", publishedUrl: data.url } : p));
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin" style={{ color: "var(--accent)" }} /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto stagger">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-1">WordPress Publishing</h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Configure per-client WordPress credentials and publish approved content directly to their site.
        </p>
      </div>

      <div className="stat-card mb-6" style={{ padding: 24 }}>
        <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
          Client
        </label>
        <select
          className="input-field"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.domain ? ` — ${c.domain}` : ""}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <>
          <div className="stat-card mb-6" style={{ padding: 24 }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.12)", color: "#3B82F6" }}>
                <Globe size={20} />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-extrabold">Credentials</h2>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Generate an Application Password in WP Admin → Users → Profile → Application Passwords.
                </p>
              </div>
              <span
                className="flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full"
                style={{
                  background: status?.configured ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                  color: status?.configured ? "#10B981" : "#EF4444",
                }}
              >
                {status?.configured ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {status?.configured ? "Configured" : "Not configured"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                  Site URL
                </label>
                <input
                  className="input-field"
                  value={wpUrl}
                  onChange={(e) => setWpUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                    WP Username
                  </label>
                  <input
                    className="input-field"
                    value={wpUsername}
                    onChange={(e) => setWpUsername(e.target.value)}
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "var(--text-muted)" }}>
                    Application Password
                  </label>
                  <input
                    className="input-field"
                    type="password"
                    value={wpAppPassword}
                    onChange={(e) => setWpAppPassword(e.target.value)}
                    placeholder={status?.configured ? "•••• •••• •••• ••••  (leave blank to keep)" : "xxxx xxxx xxxx xxxx"}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              {status?.configured ? (
                <button onClick={clearCredentials} disabled={busy} className="btn-secondary" style={{ color: "#EF4444" }}>
                  <Trash2 size={14} /> Remove credentials
                </button>
              ) : <div />}
              <button onClick={saveCredentials} disabled={busy || !wpUrl || !wpUsername || !wpAppPassword} className="btn-primary">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Verify & Save
              </button>
            </div>

            {message && (
              <div
                className="mt-4 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: message.kind === "ok" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                  color: message.kind === "ok" ? "#10B981" : "#EF4444",
                }}
              >
                {message.text}
              </div>
            )}
          </div>

          <div className="stat-card" style={{ padding: 24 }}>
            <h2 className="text-lg font-extrabold mb-4">Approved Content</h2>
            {!status?.configured ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Configure WordPress credentials above to enable publishing.
              </p>
            ) : approved.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No approved pieces ready to publish for this client.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {approved.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{p.title}</div>
                      {p.publishedUrl && (
                        <a href={p.publishedUrl} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: "var(--accent)" }}>
                          {p.publishedUrl}
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{
                          background: p.status === "PUBLISHED" ? "rgba(16,185,129,0.12)" : "rgba(124,58,237,0.12)",
                          color: p.status === "PUBLISHED" ? "#10B981" : "#7c3aed",
                        }}
                      >
                        {p.status}
                      </span>
                      {p.status !== "PUBLISHED" && (
                        <>
                          <button onClick={() => publishPiece(p.id, "draft")} disabled={busy} className="btn-secondary">
                            <Send size={12} /> Draft
                          </button>
                          <button onClick={() => publishPiece(p.id, "publish")} disabled={busy} className="btn-primary">
                            <Send size={12} /> Publish
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

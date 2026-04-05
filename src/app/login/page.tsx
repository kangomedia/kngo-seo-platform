"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogIn, AlertCircle, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    // Redirect based on role — for now go to agency dashboard
    router.push("/agency/dashboard");
    router.refresh();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        background: "linear-gradient(135deg, #0B0E14, #1A1F2E)",
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <img
            src="/brand/logo-white.svg"
            alt="KangoMedia"
            className="h-7 w-auto mx-auto mb-4"
          />
          <h1
            className="text-2xl font-extrabold"
            style={{ color: "#F1F5F9" }}
          >
            Sign in to KNGO SEO
          </h1>
          <p className="text-sm mt-2" style={{ color: "#64748B" }}>
            Enter your credentials to access the platform
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl p-8"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl mb-5 text-sm font-semibold"
              style={{
                background: "rgba(227, 66, 52, 0.1)",
                color: "#E34234",
                border: "1px solid rgba(227, 66, 52, 0.2)",
              }}
            >
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Email */}
          <div className="mb-5">
            <label
              className="text-xs font-bold uppercase tracking-wide mb-2 block"
              style={{ color: "#94A3B8" }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@kangomedia.com"
              required
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold outline-none transition-all"
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1.5px solid rgba(255, 255, 255, 0.1)",
                color: "#F1F5F9",
              }}
            />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label
              className="text-xs font-bold uppercase tracking-wide mb-2 block"
              style={{ color: "#94A3B8" }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              required
              className="w-full px-4 py-3 rounded-xl text-sm font-semibold outline-none transition-all"
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1.5px solid rgba(255, 255, 255, 0.1)",
                color: "#F1F5F9",
              }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: loading ? "#a33" : "#E34234",
              color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 20px rgba(227, 66, 52, 0.3)",
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <LogIn size={18} />
            )}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <p
          className="text-center text-xs mt-8"
          style={{ color: "#475569" }}
        >
          Built by{" "}
          <span className="font-bold" style={{ color: "#E34234" }}>
            KangoMedia
          </span>
        </p>
      </div>
    </div>
  );
}

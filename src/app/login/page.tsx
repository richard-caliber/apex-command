"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async () => {
    if (!token.trim() || loading) return;
    setLoading(true); setError(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        router.push(next);
        router.refresh();
      } else {
        setError(true); setShake(true);
        setTimeout(() => setShake(false), 600);
        setToken(""); inputRef.current?.focus();
      }
    } catch {
      setError(true); setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center" style={{ background: "#0a0e1a", color: "#f1f5f9" }}>
      <div className="text-center space-y-6" style={{ animation: shake ? "shake 0.5s ease-in-out" : "none" }}>
        <div className="text-6xl opacity-60">{"\u{1F510}"}</div>
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Apex Command</h2>
          <p className="text-sm text-[#64748b]">Enter API token to unlock</p>
        </div>
        <div className="flex items-center gap-2 max-w-sm mx-auto">
          <input
            ref={inputRef}
            type="password"
            value={token}
            onChange={(e) => { setToken(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="API token"
            className={`flex-1 bg-[#111827] border rounded-lg px-4 py-3 text-sm text-white focus:outline-none ${
              error ? "border-red-500" : "border-[#1e293b] focus:border-[#00d4d4]"
            }`}
          />
          <button
            onClick={submit}
            disabled={loading}
            className="px-4 py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
            style={{ background: "rgba(0,212,212,0.1)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.3)" }}
          >
            {loading ? "..." : "Unlock"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">Invalid token</p>}
        <style jsx>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(8px); }
            60% { transform: translateX(-6px); }
            80% { transform: translateX(6px); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

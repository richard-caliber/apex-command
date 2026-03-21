"use client";

import { useState, FormEvent } from "react";

export default function LoginScreen({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      sessionStorage.setItem("apex-auth", "1");
      onAuth();
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="glass-card p-8 w-full max-w-sm flex flex-col items-center gap-6 animate-fade-in"
      >
        {/* Logo */}
        <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
          <path d="M14 3L26 25H2L14 3Z" stroke="#06b6d4" strokeWidth="2" fill="none" />
          <path d="M14 10L20 22H8L14 10Z" fill="#06b6d4" opacity="0.3" />
        </svg>
        <h1 className="text-xl font-semibold tracking-wider">APEX COMMAND CENTRE</h1>

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
          autoFocus
        />

        {error && <p className="text-xs text-red-400">Incorrect password</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Enter"}
        </button>
      </form>
    </div>
  );
}

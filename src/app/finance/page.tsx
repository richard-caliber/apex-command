"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function FinancePage() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  return (
    <div className="min-h-dvh relative">
      <Particles />

      <header className="relative z-10 border-b border-[#1e293b] px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">APEX COMMAND CENTRE</h1>
            <nav className="flex items-center gap-4">
              <Link href="/" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">War Room</Link>
              <Link href="/pipeline" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Pipeline</Link>
              <span className="text-sm text-white font-medium">Finance</span>
              <Link href="/prompts" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Prompts</Link>
              <Link href="/squad" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Squad</Link>
              <Link href="/ideas" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Ideas</Link>
              <Link href="/map-room" className="text-sm text-[#64748b] hover:text-white transition-colors font-medium">Map Room</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#94a3b8]">
            <span className="font-mono">
              {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              {" "}
              {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className="flex items-center gap-2">
              <span className="refresh-dot" />
              <span className="text-xs">LIVE</span>
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-center" style={{ minHeight: "calc(100dvh - 80px)" }}>
        <div className="text-center">
          <div className="text-6xl mb-6">💰</div>
          <h2 className="text-3xl font-extrabold text-[#f1f5f9] mb-3">Finance — Coming Soon</h2>
          <p className="text-[#94a3b8] max-w-md mx-auto leading-relaxed">
            Monthly spend tracking, API costs, token usage, revenue by project
          </p>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {[
              { label: "API Spend", icon: "🔌" },
              { label: "Token Usage", icon: "🪙" },
              { label: "Subscriptions", icon: "📋" },
              { label: "Revenue", icon: "📈" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-[#111827] border border-[#1e293b] p-4 text-center">
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className="text-xs text-[#64748b] uppercase tracking-wider">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Particles() {
  return (
    <div className="particles" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${8 + Math.random() * 12}s`,
            animationDelay: `${Math.random() * 10}s`,
            width: `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
          }}
        />
      ))}
    </div>
  );
}

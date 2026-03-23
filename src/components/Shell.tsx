"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Mission Control", icon: "⚡" },
  { href: "/ideas", label: "Idea Backlog", icon: "💡" },
];

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex flex-col w-[200px] bg-[#0f0f12] border-r border-[#27272a] p-4 shrink-0">
        <Link href="/" className="flex items-center gap-2 mb-8">
          <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
            <path d="M14 3L26 25H2L14 3Z" stroke="#06b6d4" strokeWidth="2" fill="none" />
            <path d="M14 10L20 22H8L14 10Z" fill="#06b6d4" opacity="0.3" />
          </svg>
          <span className="text-xs font-semibold tracking-widest text-zinc-400">APEX</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0f0f12] border-b border-[#27272a]">
        <Link href="/" className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <path d="M14 3L26 25H2L14 3Z" stroke="#06b6d4" strokeWidth="2" fill="none" />
            <path d="M14 10L20 22H8L14 10Z" fill="#06b6d4" opacity="0.3" />
          </svg>
          <span className="text-xs font-semibold tracking-widest text-zinc-400">APEX</span>
        </Link>
        <button onClick={() => setMobileNav(!mobileNav)} className="text-zinc-400 text-lg">☰</button>
      </div>
      {mobileNav && (
        <div className="md:hidden bg-[#0f0f12] border-b border-[#27272a] px-4 pb-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNav(false)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                pathname === item.href ? "bg-cyan-500/10 text-cyan-400" : "text-zinc-400"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
    </div>
  );
}

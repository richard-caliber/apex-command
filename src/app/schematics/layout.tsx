"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "Master Task List", href: "/schematics/tasks" },
  { name: "Prompt Library", href: "/schematics/prompts" },
  { name: "Keys", href: "/schematics/keys" },
  { name: "IP Vault", href: "/schematics/ip-vault" },
  { name: "Squad", href: "/schematics/squad" },
];

const TOP_NAV = [
  { name: "War Room", href: "/" },
  { name: "Briefing Room", href: "/action-room" },
  { name: "Launchpad", href: "/map-room" },
  { name: "Content Factory", href: "/content-factory" },
  { name: "Machine Room", href: "/machine-room" },
  { name: "Schematics", href: "/schematics", active: true },
  { name: "Finance", href: "/finance" },
];

export default function SchematicsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActiveTab = (href: string) => {
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-dvh" style={{ background: "#0a0a0f", color: "#f1f5f9" }}>
      {/* Top Nav */}
      <header className="hidden sm:block border-b px-4 sm:px-6 lg:px-8 py-4" style={{ borderColor: "#1e1e2e" }}>
        <div className="max-w-[1800px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">APEX COMMAND CENTRE</h1>
            <nav className="flex items-center gap-4">
              {TOP_NAV.map((item) => (
                item.active ? (
                  <span key={item.name} className="text-sm font-medium" style={{ color: "#00d4d4" }}>
                    {item.name}
                  </span>
                ) : (
                  <Link key={item.name} href={item.href} className="text-sm font-medium transition-colors hover:text-white" style={{ color: "#6b6b80" }}>
                    {item.name}
                  </Link>
                )
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Sub Nav */}
      <div className="border-b px-4 sm:px-6 lg:px-8" style={{ borderColor: "#1e1e2e", background: "#0d0d14" }}>
        <div className="max-w-[1800px] mx-auto overflow-x-auto scrollbar-hide">
          <nav className="flex items-center gap-1 py-2 min-w-max">
            {TABS.map((tab) => {
              const active = isActiveTab(tab.href);
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: active ? "rgba(0, 212, 212, 0.1)" : "transparent",
                    color: active ? "#00d4d4" : "#6b6b80",
                    borderBottom: active ? "2px solid #00d4d4" : "2px solid transparent",
                  }}
                >
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Page Content */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { name: "Dashboard", href: "/content-factory" },
  { name: "Pipeline", href: "/content-factory/pipeline" },
  { name: "Tasks", href: "/content-factory/tasks" },
  { name: "Strategy", href: "/content-factory/strategy" },
  { name: "Calendar", href: "/content-factory/calendar" },
  { name: "Board", href: "/content-factory/queue" },
  { name: "Library", href: "/content-factory/library" },
  { name: "Performance", href: "/content-factory/performance" },
];

const TOP_NAV = [
  { name: "War Room", href: "/" },
  { name: "Briefing Room", href: "/action-room" },
  { name: "Launchpad", href: "/map-room" },
  { name: "Content Factory", href: "/content-factory", active: true },
  { name: "Machine Room", href: "/machine-room" },
  { name: "Schematics", href: "/schematics" },
  { name: "Finance", href: "/finance" },
];

export default function ContentFactoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActiveTab = (href: string) => {
    if (href === "/content-factory") return pathname === "/content-factory";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-dvh" style={{ background: "#0a0a0f", color: "#f1f5f9" }}>
      <header className="hidden sm:block border-b px-4 sm:px-6 lg:px-8 py-4" style={{ borderColor: "#1e1e2e" }}>
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">APEX COMMAND CENTRE</h1>
            <nav className="flex items-center gap-4">
              {TOP_NAV.map((item) =>
                item.active ? (
                  <span key={item.name} className="text-sm font-medium" style={{ color: "#00d4d4" }}>{item.name}</span>
                ) : (
                  <Link key={item.name} href={item.href} className="text-sm font-medium transition-colors hover:text-white" style={{ color: "#6b6b80" }}>{item.name}</Link>
                )
              )}
            </nav>
          </div>
        </div>
      </header>

      <div className="border-b px-4 sm:px-6 lg:px-8" style={{ borderColor: "#1e1e2e", background: "#0d0d14" }}>
        <div className="max-w-[1800px] mx-auto overflow-x-auto scrollbar-hide">
          <nav className="flex items-center gap-1 py-2 min-w-max">
            {TABS.map((tab) => {
              const active = isActiveTab(tab.href);
              return (
                <Link key={tab.name} href={tab.href}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap"
                  style={{
                    background: active ? "rgba(0,212,212,0.1)" : "transparent",
                    color: active ? "#00d4d4" : "#6b6b80",
                    borderBottom: active ? "2px solid #00d4d4" : "2px solid transparent",
                  }}>
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</main>
    </div>
  );
}

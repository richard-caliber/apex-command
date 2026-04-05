"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "War Room", icon: "\u2302" },
  { href: "/action-room", label: "Briefing", icon: "\u26A1" },
  { href: "/squad", label: "Squad", icon: "\u2725" },
  { href: "/map-room", label: "Launch", icon: "\u{1F680}" },
  { href: "/prompts", label: "Prompts", icon: "\uD83D\uDCDC" },
  { href: "/vault", label: "Keys", icon: "\u{1F511}" },
  { href: "/tasks", label: "Tasks", icon: "\uD83D\uDCCB" },
  { href: "/finance", label: "Finance", icon: "\u00A3" },
  { href: "/content-factory", label: "Content", icon: "\uD83C\uDFAC" },
  { href: "/machine-room", label: "Machine", icon: "\uD83D\uDD27" },
];

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex sm:hidden items-center justify-around border-t"
      style={{
        background: "rgba(10, 10, 15, 0.95)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderColor: "#1e293b",
      }}
    >
      {TABS.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-col items-center gap-0.5 py-2.5 px-2 min-w-0 flex-1 transition-colors"
            style={{ color: active ? "#00d4d4" : "#475569" }}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="text-[9px] font-semibold tracking-wider uppercase truncate">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function daysLive(launchDate: string | null): number | null {
  if (!launchDate) return null;
  return Math.floor((Date.now() - new Date(launchDate).getTime()) / 86400000);
}

export function getAction(status: string, launchDate: string | null, mrr: number): { label: string; color: string; emoji: string } {
  if (status === "building") return { label: "Building", color: "text-blue-400 bg-blue-500/10 border-blue-500/30", emoji: "🔵" };
  if (status === "queued") return { label: "Queued", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30", emoji: "⚪" };
  if (status === "complete") return { label: "Complete", color: "text-green-400 bg-green-500/10 border-green-500/30", emoji: "✅" };
  if (status === "paused") return { label: "Paused", color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30", emoji: "⚫" };

  const days = daysLive(launchDate);
  if (days === null) return { label: "—", color: "text-zinc-500", emoji: "" };
  if (days > 30 && mrr < 500) return { label: "Kill?", color: "text-red-400 bg-red-500/10 border-red-500/30", emoji: "🔴" };
  if (days > 14 && mrr > 200) return { label: "Scale", color: "text-green-400 bg-green-500/10 border-green-500/30", emoji: "🟢" };
  if (days < 14) return { label: "Measuring", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", emoji: "🟡" };
  return { label: "Review", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30", emoji: "🟡" };
}

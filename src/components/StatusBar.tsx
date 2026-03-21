"use client";

interface StatusBarProps {
  activeAgents: string;
  pipelineStatus: string;
  nextCron: string;
  revenue: string;
}

export default function StatusBar({ activeAgents, pipelineStatus, nextCron, revenue }: StatusBarProps) {
  return (
    <footer className="glass-card px-6 py-3 mt-6 animate-fade-in" style={{ animationDelay: "0.3s" }}>
      <p className="text-xs text-gray-500 text-center" style={{ fontFamily: "var(--font-mono)" }}>
        Agents: <span className="text-gray-300">{activeAgents}</span> active
        {" | "}Pipeline: <span className="text-emerald-400">✅ {pipelineStatus}</span>
        {" | "}Next cron: <span className="text-gray-300">{nextCron}</span>
        {" | "}Revenue: <span className="text-gray-300">{revenue}</span>
      </p>
    </footer>
  );
}

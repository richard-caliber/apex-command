"use client";

import type { Revenue } from "@/types";

export default function RevenueDashboard({ revenue }: { revenue: Revenue }) {
  const pct = revenue.target > 0 ? (revenue.totalMRR / revenue.target) * 100 : 0;

  // Progress bar colour
  const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 30 ? "bg-amber-500" : "bg-red-500";

  // Chart: find max for scaling
  const maxChart = Math.max(...revenue.monthly.map((m) => Math.max(m.actual, m.projected)), 1);

  return (
    <div className="quad-card p-4 h-full flex flex-col animate-fade-in" style={{ animationDelay: "0.05s" }}>
      <h2 className="text-xs font-semibold text-gray-500 tracking-widest uppercase mb-2">Revenue Dashboard</h2>

      {/* Hero MRR */}
      <div className="mb-3">
        <div className="animate-count">
          <span
            className="font-bold text-gray-100 leading-none"
            style={{ fontSize: "clamp(36px, 5vw, 56px)", fontFamily: "var(--font-mono)" }}
          >
            {revenue.currency}{revenue.totalMRR.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Target: {revenue.currency}{revenue.target.toLocaleString()}/mo
        </p>
        {/* Main progress bar */}
        <div className="w-full h-2.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full rounded-full ${barColor} animate-bar`}
            style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0.5)}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-gray-600">{revenue.currency}0</span>
          <span className="text-[9px] text-gray-600">{revenue.currency}{revenue.target.toLocaleString()}</span>
        </div>
      </div>

      {/* Monthly chart */}
      <div className="mb-3 flex-shrink-0">
        <div className="flex items-end gap-1.5 h-[70px]">
          {revenue.monthly.map((m) => {
            const actH = (m.actual / maxChart) * 60;
            const projH = (m.projected / maxChart) * 60;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="flex items-end gap-px h-[60px] w-full justify-center">
                  <div
                    className="w-[5px] bg-cyan-500 rounded-sm animate-bar"
                    style={{ height: `${Math.max(actH, m.actual > 0 ? 3 : 1)}px` }}
                  />
                  <div
                    className="w-[5px] rounded-sm animate-bar"
                    style={{
                      height: `${Math.max(projH, m.projected > 0 ? 3 : 1)}px`,
                      background: "repeating-linear-gradient(0deg, #4b5563 0px, #4b5563 2px, transparent 2px, transparent 4px)",
                    }}
                  />
                </div>
                <span className="text-[8px] text-gray-600">{m.month.split(" ")[0].slice(0, 3)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-[8px] text-gray-500">
            <span className="w-1.5 h-1.5 bg-cyan-500 rounded-sm" /> Actual
          </span>
          <span className="flex items-center gap-1 text-[8px] text-gray-500">
            <span className="w-1.5 h-1.5 bg-gray-600 rounded-sm" /> Projected
          </span>
        </div>
      </div>

      {/* Per-product breakdown */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {revenue.byProduct.map((p) => {
          const ppct = p.target > 0 ? (p.mrr / p.target) * 100 : 0;
          return (
            <div key={p.name}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] text-gray-400">{p.name}</span>
                <span className="text-[10px] text-gray-600" style={{ fontFamily: "var(--font-mono)" }}>
                  {revenue.currency}{p.mrr} / {revenue.currency}{p.target.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500/70 rounded-full animate-bar"
                  style={{ width: `${Math.max(ppct, ppct > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

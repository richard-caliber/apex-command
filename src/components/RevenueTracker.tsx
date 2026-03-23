"use client";

import { useState } from "react";
import type { Revenue } from "@/types";

export default function RevenueTracker({ revenue }: { revenue: Revenue }) {
  const [expanded, setExpanded] = useState(false);

  // Find active phase (first one where totalMRR < target)
  const activeIdx = revenue.targets.findIndex((t) => revenue.totalMRR < t.target);
  const activePhase = activeIdx >= 0 ? revenue.targets[activeIdx] : revenue.targets[revenue.targets.length - 1];

  return (
    <section className="mb-8">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 group w-full text-left"
      >
        <h2 className="text-base font-semibold text-gray-400">💰 Revenue</h2>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
          {revenue.currency}{revenue.totalMRR}/mo
        </span>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={`text-gray-500 transition-transform ${expanded ? "" : "-rotate-90"}`}
        >
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {expanded && (
        <div className="space-y-5">
          {/* Active target */}
          <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-800/50">
            <p className="text-sm font-semibold text-cyan-400 mb-1">{activePhase.label}</p>
            <p className="text-xs text-gray-500">Target: {revenue.currency}{activePhase.target.toLocaleString()} by {activePhase.deadline}</p>
          </div>

          {/* Phase milestones */}
          <div className="flex gap-2">
            {revenue.targets.map((t, i) => {
              const isActive = i === activeIdx;
              const isPast = activeIdx > i;
              return (
                <div
                  key={i}
                  className={`flex-1 p-3 rounded-lg border text-center transition-all ${
                    isActive
                      ? "bg-cyan-500/10 border-cyan-500/30"
                      : isPast
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-gray-900/30 border-gray-800/30 opacity-40"
                  }`}
                >
                  <p className={`text-[11px] font-semibold ${isActive ? "text-cyan-400" : isPast ? "text-emerald-400" : "text-gray-500"}`}>
                    {revenue.currency}{t.target.toLocaleString()}
                  </p>
                  <p className="text-[9px] text-gray-500 mt-0.5">{t.deadline}</p>
                </div>
              );
            })}
          </div>

          {/* Per-product MRR */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Per Product</h3>
            {revenue.byProduct.map((p) => {
              const pct = p.target > 0 ? (p.mrr / p.target) * 100 : 0;
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{p.name}</span>
                    <span className="text-xs text-gray-500">
                      {revenue.currency}{p.mrr} / {revenue.currency}{p.target.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mb-0.5">
                    <div
                      className="h-full bg-cyan-500 rounded-full transition-all"
                      style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-600">{p.basis}</p>
                </div>
              );
            })}
          </div>

          {/* Monthly trend */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Monthly Trend</h3>
            <div className="flex items-end gap-3 h-[100px]">
              {revenue.monthly.map((m) => {
                const maxVal = Math.max(...revenue.monthly.map((x) => Math.max(x.actual, x.projected)), 1);
                const actualH = (m.actual / maxVal) * 80;
                const projH = (m.projected / maxVal) * 80;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-end gap-0.5 h-[80px]">
                      <div
                        className="w-3 bg-cyan-500 rounded-sm transition-all"
                        style={{ height: `${Math.max(actualH, m.actual > 0 ? 4 : 2)}px` }}
                      />
                      <div
                        className="w-3 bg-gray-700 rounded-sm transition-all"
                        style={{ height: `${Math.max(projH, m.projected > 0 ? 4 : 2)}px` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-600">{m.month.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-[9px] text-gray-500">
                <span className="w-2 h-2 bg-cyan-500 rounded-sm" /> Actual
              </span>
              <span className="flex items-center gap-1 text-[9px] text-gray-500">
                <span className="w-2 h-2 bg-gray-700 rounded-sm" /> Projected
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

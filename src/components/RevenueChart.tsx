"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { date: string; total: number }[];
}

export default function RevenueChart({ data }: Props) {
  const hasData = data.length > 0 && data.some((d) => d.total > 0);

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-4">
      <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Revenue (30d)</h2>
      {hasData ? (
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) =>
                  new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                }
                tick={{ fontSize: 10, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#71717a" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `£${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(v) =>
                  new Date(String(v)).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                }
                formatter={(v) => [`£${v}`, "MRR"]}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#06b6d4"
                fill="url(#grad)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[180px] flex flex-col items-center justify-center gap-3">
          <div className="w-full h-[60px] relative opacity-20">
            <div className="absolute inset-x-0 bottom-0 h-px bg-zinc-700" />
            <div className="absolute inset-x-0 bottom-[30%] h-px bg-zinc-800" />
            <div className="absolute inset-x-0 bottom-[60%] h-px bg-zinc-800" />
          </div>
          <p className="text-sm text-zinc-500">Revenue data will appear here once connected</p>
          <button className="px-4 py-2 bg-[#635bff]/20 text-[#a29bfe] text-xs font-semibold rounded-lg border border-[#635bff]/30 hover:bg-[#635bff]/30 transition-colors">
            Connect Stripe →
          </button>
        </div>
      )}
    </div>
  );
}

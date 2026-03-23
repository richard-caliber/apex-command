"use client";

import { useState } from "react";
import useSWR from "swr";
import type { DashboardData } from "@/types";
import TopBar from "@/components/TopBar";
import SquadStatus from "@/components/SquadStatus";
import RevenueDashboard from "@/components/RevenueDashboard";
import ActiveProjects from "@/components/ActiveProjects";
import IdeaPipeline from "@/components/IdeaPipeline";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Home() {
  const [demoMode, setDemoMode] = useState(true);

  const { data } = useSWR<DashboardData>(
    "/api/status",
    fetcher,
    { refreshInterval: 30000 }
  );

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col p-2 md:p-3 overflow-hidden">
      <TopBar
        systemStatus={data.system.status}
        lastUpdated={data.lastUpdated}
        demoMode={demoMode}
        onToggleDemo={() => setDemoMode(!demoMode)}
      />

      {/* Mobile: stack vertically with Revenue on top. Desktop: 2x2 grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-2 md:gap-3 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Mobile order: Revenue first (hero), then Squad, Projects, Ideas */}
        <div className="order-1 lg:order-2 min-h-[350px] lg:min-h-0">
          {data.revenue && <RevenueDashboard revenue={data.revenue} />}
        </div>
        <div className="order-2 lg:order-1 min-h-[300px] lg:min-h-0">
          {data.agents && <SquadStatus agents={data.agents} />}
        </div>
        <div className="order-3 min-h-[300px] lg:min-h-0">
          {data.projects && <ActiveProjects projects={data.projects} />}
        </div>
        <div className="order-4 min-h-[300px] lg:min-h-0">
          {data.ideas && <IdeaPipeline ideas={data.ideas} />}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import useSWR from "swr";
import type { DashboardData } from "@/types";
import TopBar from "@/components/TopBar";
import TasksByProject from "@/components/TasksByProject";
import IdeaPipeline from "@/components/IdeaPipeline";
import RevenueTracker from "@/components/RevenueTracker";
import SquadStatus from "@/components/SquadStatus";
import ActivityFeed from "@/components/ActivityFeed";

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
        <div className="text-gray-500 text-sm animate-pulse">Loading command centre...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen px-4 py-4 md:px-8 md:py-6 max-w-[900px] mx-auto">
      <TopBar
        systemStatus={data.system.status}
        lastUpdated={data.lastUpdated}
        demoMode={demoMode}
        onToggleDemo={() => setDemoMode(!demoMode)}
      />

      {/* Daily Tasks — the main section */}
      {data.tasksByProject && <TasksByProject groups={data.tasksByProject} />}

      {/* Idea Pipeline — collapsed */}
      {data.ideas && <IdeaPipeline ideas={data.ideas} />}

      {/* Revenue Tracker — collapsed */}
      {data.revenue && <RevenueTracker revenue={data.revenue} />}

      {/* Squad Status — collapsed */}
      {data.agents && <SquadStatus agents={data.agents} />}

      {/* Activity Feed — collapsed */}
      {data.activity && <ActivityFeed activity={data.activity} />}
    </main>
  );
}

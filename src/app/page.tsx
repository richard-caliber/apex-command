"use client";

import { useState } from "react";
import useSWR from "swr";
import type { DashboardData } from "@/types";
import TopBar from "@/components/TopBar";
import AgentGrid from "@/components/AgentGrid";
import ProjectCards from "@/components/ProjectCards";
import ActivityFeed from "@/components/ActivityFeed";
import StatusBar from "@/components/StatusBar";

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
    <main className="min-h-screen px-4 py-4 md:px-8 md:py-6 max-w-[1400px] mx-auto">
      {/* 1. Top Bar */}
      <TopBar
        systemStatus={data.system.status}
        lastUpdated={data.lastUpdated}
        demoMode={demoMode}
        onToggleDemo={() => setDemoMode(!demoMode)}
      />

      {/* 2. Agent Grid */}
      <AgentGrid agents={data.agents} />

      {/* 3. Projects + Activity Feed */}
      <section
        className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6 animate-fade-in"
        style={{ animationDelay: "0.2s" }}
      >
        <div className="lg:col-span-2">
          <ProjectCards projects={data.projects} />
        </div>
        <div className="lg:col-span-3">
          <ActivityFeed activity={data.activity} />
        </div>
      </section>

      {/* 4. Bottom Status Bar */}
      <StatusBar
        activeAgents={data.footer.activeAgents}
        pipelineStatus={data.footer.pipelineStatus}
        nextCron={data.footer.nextCron}
        revenue={data.footer.revenue}
      />
    </main>
  );
}

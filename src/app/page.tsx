"use client";

import { useState } from "react";
import useSWR from "swr";
import type { DashboardData } from "@/types";
import TopBar from "@/components/TopBar";
import AgentGrid from "@/components/AgentGrid";
import ProjectCards from "@/components/ProjectCards";
import TaskList from "@/components/TaskList";
import IdeaPipeline from "@/components/IdeaPipeline";
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

      {/* 3. Project Cards */}
      <section className="mb-6 animate-fade-in" style={{ animationDelay: "0.15s" }}>
        <ProjectCards projects={data.projects} />
      </section>

      {/* 4. Task List */}
      {data.tasks && data.taskMetrics && (
        <TaskList tasks={data.tasks} metrics={data.taskMetrics} />
      )}

      {/* 5. Idea Pipeline (collapsed by default) */}
      {data.ideas && <IdeaPipeline ideas={data.ideas} />}

      {/* 6. Activity Feed */}
      <section className="mb-6 animate-fade-in" style={{ animationDelay: "0.25s" }}>
        <ActivityFeed activity={data.activity} />
      </section>

      {/* 7. Bottom Status Bar */}
      <StatusBar
        activeAgents={data.footer.activeAgents}
        pipelineStatus={data.footer.pipelineStatus}
        nextCron={data.footer.nextCron}
        revenue={data.footer.revenue}
      />
    </main>
  );
}

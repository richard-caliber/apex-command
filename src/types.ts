export interface App {
  id: string;
  name: string;
  icon: string;
  url: string;
  status: "live" | "building" | "paused" | "queued" | "complete";
  launchDate: string | null;
  mrr: number;
  targetMRR: number;
  dau: number;
  conversionRate: number;
  pricing: string;
  techStack: string;
  notes: string;
  competitors: string;
  decisions: { date: string; action: string; reason: string }[];
}

export interface Idea {
  id: string;
  name: string;
  stage: "incoming" | "validating" | "ready" | "building" | "live" | "parked";
  niche: string;
  ev: "high" | "medium" | "low";
  buildTime: string;
  owner?: string;
  score?: number;
  scoreBreakdown?: { label: string; value: number }[];
  blocker?: string;
  researchLink?: string;
}

export interface ActivityEntry {
  time: string;
  event: string;
  app: string;
}

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  status: "active" | "paused";
  currentTask: string;
}

export interface RevenueHistoryEntry {
  date: string;
  total: number;
}

export interface TaskItem {
  id: string;
  task: string;
  priority: "high" | "medium" | "low";
  type: "one-off" | "recurring" | "automatable";
  status: "pending" | "done";
}

export interface TaskGroup {
  project: string;
  name: string;
  icon: string;
  tasks: TaskItem[];
}

export interface DashboardData {
  lastUpdated: string;
  portfolio: {
    totalMRR: number;
    target: number;
    totalApps: number;
    liveApps: number;
    buildingApps: number;
    queuedApps: number;
    decisionsNeeded: number;
  };
  apps: App[];
  ideas: Idea[];
  revenueHistory: RevenueHistoryEntry[];
  activity: ActivityEntry[];
  agents: Agent[];
  tasksByProject?: TaskGroup[];
}

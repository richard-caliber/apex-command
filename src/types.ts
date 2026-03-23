export interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: "active" | "idle" | "error" | "paused";
  lastSeen: string;
  currentTask: string;
  model: string;
}

export interface Project {
  name: string;
  icon: string;
  status: "live" | "building" | "blocked" | "paused" | "complete" | "idea";
  progress: number;
  mrr: number;
  targetMRR: number;
  lastActivity: string;
  nextAction: string;
}

export interface ProductRevenue {
  name: string;
  mrr: number;
  target: number;
}

export interface MonthlyRevenue {
  month: string;
  actual: number;
  projected: number;
}

export interface Revenue {
  totalMRR: number;
  currency: string;
  target: number;
  byProduct: ProductRevenue[];
  monthly: MonthlyRevenue[];
}

export interface Idea {
  id: string;
  title: string;
  stage: "incoming" | "researching" | "building" | "live" | "killed";
  ev: "high" | "medium" | "low";
  description: string;
  agent: string | null;
}

export interface ActivityEntry {
  time: string;
  agent: string;
  event: string;
}

export interface DashboardData {
  lastUpdated: string;
  system: {
    status: string;
    uptime: string;
    activeAgents: number;
    totalAgents: number;
  };
  agents: Agent[];
  revenue: Revenue;
  projects: Project[];
  ideas: Idea[];
  activity: ActivityEntry[];
  footer: {
    activeAgents: string;
    pipelineStatus: string;
    nextCron: string;
    revenue: string;
  };
}

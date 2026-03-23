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

export interface Task {
  id: string;
  task: string;
  priority: "high" | "medium" | "low";
  type: "one-off" | "recurring" | "automatable";
  recurringNote?: string;
  automatableNote?: string;
  status: "pending" | "done";
}

export interface ProjectGroup {
  project: string;
  name: string;
  icon: string;
  stage: string;
  stageColor: "green" | "yellow" | "red" | "grey";
  blocker: string | null;
  stepsToRevenue: number | null;
  tasks: Task[];
}

export interface Idea {
  id: string;
  title: string;
  stage: "incoming" | "researching" | "ready" | "building" | "live" | "killed";
  ev: "high" | "medium" | "low";
  description: string;
  agent: string | null;
  daysInStage?: number;
}

export interface RevenueTarget {
  label: string;
  target: number;
  deadline: string;
}

export interface ProductRevenue {
  name: string;
  mrr: number;
  target: number;
  basis: string;
}

export interface MonthlyRevenue {
  month: string;
  actual: number;
  projected: number;
}

export interface Revenue {
  totalMRR: number;
  currency: string;
  targets: RevenueTarget[];
  byProduct: ProductRevenue[];
  monthly: MonthlyRevenue[];
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
  tasksByProject: ProjectGroup[];
  ideas: Idea[];
  revenue: Revenue;
  agents: Agent[];
  activity: ActivityEntry[];
  pipeline: {
    date: string;
    stages: { name: string; status: string }[];
  };
  footer: {
    activeAgents: string;
    pipelineStatus: string;
    nextCron: string;
    revenue: string;
  };
}

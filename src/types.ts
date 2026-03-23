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
  codename: string;
  name: string;
  icon?: string;
  logo?: string;
  progress: number;
  status: "on-track" | "attention" | "blocked" | "paused";
  stage: string;
  lastAction: string;
}

export interface Task {
  id: string;
  task: string;
  project: string;
  priority: "high" | "medium" | "low";
  type: "human" | "approve" | "review" | "automated";
  status: "pending" | "done";
  assignedBy: string;
}

export interface TaskMetrics {
  doneToday: number;
  totalToday: number;
  automationLevel: number;
  stepsToRevenue: {
    closest: string;
    remaining: number;
  };
}

export interface Idea {
  id: string;
  title: string;
  stage: "incoming" | "researching" | "ready" | "in-progress" | "launched" | "killed";
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
  projects: Project[];
  tasks: Task[];
  taskMetrics: TaskMetrics;
  ideas: Idea[];
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

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
  progress: number;
  status: "on-track" | "attention" | "blocked" | "paused";
  stage: string;
  lastAction: string;
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

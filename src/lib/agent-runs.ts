import { kv } from "@vercel/kv";

export interface AgentRunRecord {
  run_id: string;
  timestamp: string;
  model_used: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  task_id: string | null;
  task_name: string | null;
  status: "success" | "failed" | "timeout";
  error?: string;
  latency_ms: number;
}

export interface AgentRunsMonth {
  agent_id: string;
  month: string; // YYYY-MM
  runs: AgentRunRecord[];
  lastUpdated: string;
}

function key(agentId: string, month: string) {
  return `apex:agent-runs:${agentId}:${month}`;
}

export function currentMonth(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export async function getRunsForMonth(agentId: string, month: string): Promise<AgentRunsMonth> {
  const cached = await kv.get<AgentRunsMonth>(key(agentId, month));
  if (cached) return cached;
  return {
    agent_id: agentId,
    month,
    runs: [],
    lastUpdated: new Date().toISOString(),
  };
}

export async function appendRun(agentId: string, run: AgentRunRecord): Promise<AgentRunsMonth> {
  const month = run.timestamp.slice(0, 7);
  const k = key(agentId, month);
  const existing = (await kv.get<AgentRunsMonth>(k)) ?? {
    agent_id: agentId,
    month,
    runs: [],
    lastUpdated: new Date().toISOString(),
  };
  existing.runs.push(run);
  existing.lastUpdated = new Date().toISOString();
  await kv.set(k, existing);
  return existing;
}

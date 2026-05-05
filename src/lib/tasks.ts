import { kv } from "@vercel/kv";

const KV_KEY = "apex:pipeline-tasks";

export interface Task {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  stage?: string;
  status?: string;
  automation?: string;
  owner?: string;
  model?: string;
  prompt_id?: string;
  output?: string;
  quality_gate?: string;
  blocker?: string | null;
  next_task?: string;
  order?: number;
  priority?: string;
  source?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface TaskFilter {
  project_id?: string;
  owner?: string;
  status?: string;
  stage?: string;
}

interface TaskStore {
  tasks: Task[];
  lastUpdated: string;
}

const DEFAULT_LIMIT = 100;

async function loadStore(): Promise<TaskStore> {
  const raw = await kv.get<TaskStore | string>(KV_KEY);
  if (raw === null || raw === undefined) {
    return { tasks: [], lastUpdated: new Date().toISOString() };
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as TaskStore;
      return parsed?.tasks ? parsed : { tasks: [], lastUpdated: new Date().toISOString() };
    } catch (e) {
      throw new Error(`Failed to parse ${KV_KEY} as JSON: ${(e as Error).message}`);
    }
  }
  if (!raw.tasks || !Array.isArray(raw.tasks)) {
    return { tasks: [], lastUpdated: raw.lastUpdated ?? new Date().toISOString() };
  }
  return raw;
}

function sortByUpdatedDesc(a: Task, b: Task): number {
  const au = a.updated_at ?? "";
  const bu = b.updated_at ?? "";
  return bu.localeCompare(au);
}

export async function getAllTasks(filter?: TaskFilter, limit: number = DEFAULT_LIMIT): Promise<Task[]> {
  const store = await loadStore();
  let tasks = store.tasks;
  if (filter?.project_id) tasks = tasks.filter((t) => t.project_id === filter.project_id);
  if (filter?.owner) tasks = tasks.filter((t) => t.owner === filter.owner);
  if (filter?.status) tasks = tasks.filter((t) => t.status === filter.status);
  if (filter?.stage) tasks = tasks.filter((t) => t.stage === filter.stage);
  tasks = [...tasks].sort(sortByUpdatedDesc);
  return tasks.slice(0, limit);
}

export async function getTasksForProject(projectId: string): Promise<Task[]> {
  if (!projectId) return [];
  const store = await loadStore();
  return store.tasks.filter((t) => t.project_id === projectId).sort(sortByUpdatedDesc);
}

export async function getTasksForOwner(ownerId: string, limit: number = DEFAULT_LIMIT): Promise<Task[]> {
  if (!ownerId) return [];
  const store = await loadStore();
  return store.tasks
    .filter((t) => t.owner === ownerId)
    .sort(sortByUpdatedDesc)
    .slice(0, limit);
}

export async function getTaskStoreLastUpdated(): Promise<string> {
  const store = await loadStore();
  return store.lastUpdated;
}

export async function getTaskById(id: string): Promise<Task | null> {
  if (!id) return null;
  const store = await loadStore();
  return store.tasks.find((t) => t.id === id) ?? null;
}

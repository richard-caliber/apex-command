import { kv } from "@vercel/kv";

const KV_KEY = "apex:warroom:projects";

export interface Project {
  id: string;
  name: string;
  stage: string;
  status: string;
  description?: string;
  blocker?: string | null;
  tags?: string[];
  url?: string;
  owner?: string;
  score?: number | null;
  featured?: boolean;
  image_url?: string;
  metrics?: Record<string, string>;
  order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectFilter {
  status?: string;
  stage?: string;
  tag?: string;
}

interface ProjectStore {
  projects: Project[];
  lastUpdated: string;
}

async function loadStore(): Promise<ProjectStore> {
  const raw = await kv.get<ProjectStore | string>(KV_KEY);
  if (raw === null || raw === undefined) {
    return { projects: [], lastUpdated: new Date().toISOString() };
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as ProjectStore;
      return parsed?.projects ? parsed : { projects: [], lastUpdated: new Date().toISOString() };
    } catch (e) {
      throw new Error(`Failed to parse ${KV_KEY} as JSON: ${(e as Error).message}`);
    }
  }
  if (!raw.projects || !Array.isArray(raw.projects)) {
    return { projects: [], lastUpdated: raw.lastUpdated ?? new Date().toISOString() };
  }
  return raw;
}

export async function getAllProjects(filter?: ProjectFilter): Promise<Project[]> {
  const store = await loadStore();
  let projects = store.projects;
  if (filter?.status) projects = projects.filter((p) => p.status === filter.status);
  if (filter?.stage) projects = projects.filter((p) => p.stage === filter.stage);
  if (filter?.tag) projects = projects.filter((p) => Array.isArray(p.tags) && p.tags.includes(filter.tag!));
  return projects;
}

export async function getProject(id: string): Promise<Project | null> {
  if (!id) return null;
  const store = await loadStore();
  return store.projects.find((p) => p.id === id) ?? null;
}

export async function getProjectStoreLastUpdated(): Promise<string> {
  const store = await loadStore();
  return store.lastUpdated;
}

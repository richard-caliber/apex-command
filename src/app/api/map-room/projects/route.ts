import { NextResponse } from "next/server";
import { getAllProjects } from "@/lib/projects";

// GET reads canonical apex:warroom:projects via the projects lib and
// projects each record into the maproom shape.
//
// The legacy maproom:projects POST handler was retired in M4 — that
// store is deleted. Writes go through /api/projects POST { action: "set" }
// or MCP apex_set_project, both targeting apex:warroom:projects.

interface CanonicalProject {
  id: string;
  name: string;
  description: string;
  stage: string;
  status: string;
  blocker: string;
  owner: string;
  updated_at?: string;
  created_at?: string;
}

const STAGE_INDEX: Record<string, number> = {
  inbox: 0, idea: 1, validation: 2, design: 3, mvp: 4,
  traffic: 5, conversion: 6, delivery: 7, scale: 8,
};

function toMapRoomShape(p: CanonicalProject) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    current_stage: STAGE_INDEX[p.stage?.toLowerCase()] ?? 0,
    status: p.status ?? "active",
    blockers: p.blocker ? [p.blocker] : [],
    owners: p.owner ? [p.owner] : [],
    automation_score: "",
    notes: "",
    created_at: p.created_at ?? "",
    updated_at: p.updated_at ?? "",
  };
}

export async function GET() {
  const projects = await getAllProjects();
  const items = projects.map((p) => toMapRoomShape(p as unknown as CanonicalProject));
  return NextResponse.json({ items, lastUpdated: new Date().toISOString() });
}

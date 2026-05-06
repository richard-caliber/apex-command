import { NextResponse } from "next/server";
import { getAllProjects, getProjectStoreLastUpdated } from "@/lib/projects";

// GET reads canonical apex:warroom:projects via the projects lib.
// Legacy apex:projects POST handler retired in M4 — that store is now
// deleted. Writes go to apex:warroom:projects via /api/projects (which
// is what the MCP write tools and Mission Control already use).

export async function GET() {
  const projects = await getAllProjects();
  const lastUpdated = await getProjectStoreLastUpdated();
  return NextResponse.json({ projects, lastUpdated });
}

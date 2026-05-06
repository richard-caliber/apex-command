import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/projects";

// GET reads canonical apex:warroom:projects via the projects lib and
// reshapes into the legacy "war room" shape this endpoint historically
// returned (image, statusLine, keyMetric).
//
// The PUT handler that wrote to the legacy apex:projects store was
// retired in M4 — that store is deleted. Project edits go through MCP
// (apex_set_project) or /api/projects POST { action: "set" }, both of
// which target the canonical apex:warroom:projects store.
//
// The legacy side-load that pulled `tasks/overdueTasks/blockedTasks`
// from apex:projects was also retired — that data lived in the deleted
// store and the project detail page sources its task array from
// /api/project/[id] (the apex:project:{id} enrichment store, kept).

interface CanonicalProject {
  id: string;
  name: string;
  stage: string;
  status: string;
  image_url?: string;
  blocker?: string | null;
  metrics?: Record<string, string>;
}

function toLegacyShape(p: CanonicalProject) {
  const metrics = p.metrics ?? {};
  const firstMetricKey = Object.keys(metrics)[0];
  const keyMetric = firstMetricKey
    ? { label: firstMetricKey.replace(/_/g, " "), value: metrics[firstMetricKey] }
    : { label: "", value: "" };
  return {
    id: p.id,
    name: p.name,
    image: p.image_url || "",
    stage: p.stage,
    status: p.status,
    statusLine: p.blocker || "",
    bottleneck: p.blocker || "",
    keyMetric,
    overdueTasks: 0,
    blockedTasks: 0,
    tasks: [],
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const canonical = await getProject(projectId);
  if (!canonical) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(toLegacyShape(canonical as unknown as CanonicalProject));
}

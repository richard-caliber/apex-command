import { NextResponse } from "next/server";

// M4: this route wrote tasks to the legacy apex:projects store, which
// was deleted in M4. Returning 410 Gone documents the retirement so any
// stray caller fails loudly rather than silently writing to nothing.
// Project detail tasks now live in /api/project/[id] (apex:project:{id}
// enrichment store) and pipeline tasks in /api/pipeline-tasks
// (apex:pipeline-tasks canonical store).

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Retired in M4 — legacy apex:projects store was deleted. Use /api/project/[id] for project-detail tasks or /api/pipeline-tasks for pipeline tasks.",
    },
    { status: 410 },
  );
}

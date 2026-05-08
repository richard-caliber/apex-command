import { NextResponse } from "next/server";
import { buildBriefing } from "@/lib/briefing";

export async function GET() {
  const briefing = await buildBriefing();
  return NextResponse.json(briefing);
}

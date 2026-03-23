import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";
import { readFile } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const { title, description } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    // Load current data
    let data;
    try {
      const { blobs } = await list({ prefix: "apex-data.json" });
      if (blobs.length > 0) {
        const res = await fetch(blobs[0].url);
        if (res.ok) data = await res.json();
      }
    } catch {
      // fall through
    }

    if (!data) {
      const filePath = join(process.cwd(), "public", "sample-data.json");
      const raw = await readFile(filePath, "utf-8");
      data = JSON.parse(raw);
    }

    const ideas = data.ideas || [];
    const newIdea = {
      id: `i${Date.now()}`,
      title,
      description: description || "",
      stage: "incoming",
      ev: "medium",
      agent: null,
      daysInStage: 0,
    };
    ideas.push(newIdea);
    data.ideas = ideas;
    data.lastUpdated = new Date().toISOString();

    await put("apex-data.json", JSON.stringify(data), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return NextResponse.json({ ok: true, idea: newIdea });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

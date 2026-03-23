import { NextResponse } from "next/server";
import { list, head } from "@vercel/blob";
import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  // Try Vercel Blob first (live data)
  try {
    const { blobs } = await list({ prefix: "apex-data.json" });
    if (blobs.length > 0) {
      const blob = await head(blobs[0].url);
      const res = await fetch(blob.url);
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data, {
          headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
        });
      }
    }
  } catch {
    // Blob not configured or empty — fall through to sample data
  }

  // Fall back to sample data
  const filePath = join(process.cwd(), "public", "sample-data.json");
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
}

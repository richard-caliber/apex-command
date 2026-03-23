import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const apiKey = process.env.APEX_API_KEY;
  const auth = req.headers.get("authorization");

  if (!apiKey || auth !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data = {
    ...body,
    lastUpdated: body.lastUpdated || new Date().toISOString(),
  };

  await put("apex-data.json", JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
  });

  return NextResponse.json({ ok: true, updated: data.lastUpdated });
}

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  try {
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

    const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN;

    if (!hasToken) {
      return NextResponse.json({ error: "BLOB_READ_WRITE_TOKEN not configured" }, { status: 500 });
    }

    await put("apex-data.json", JSON.stringify(data), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return NextResponse.json({ ok: true, updated: data.lastUpdated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

/**
 * RFC 9728 — OAuth 2.0 Protected Resource Metadata.
 * Declares which authorization server(s) issue tokens for this resource.
 * Claude.ai fetches this on the resource's origin to learn where to start the OAuth flow.
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      resource: `${origin}/api/mcp`,
      authorization_servers: [origin],
      bearer_methods_supported: ["header"],
      scopes_supported: ["apex:full"],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

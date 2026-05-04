import { NextRequest, NextResponse } from "next/server";

/**
 * RFC 8414 — OAuth 2.0 Authorization Server Metadata.
 * Tells Claude.ai which endpoints to hit for client registration, authorization, and token exchange.
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
      token_endpoint: `${origin}/api/mcp/oauth/token`,
      registration_endpoint: `${origin}/api/mcp/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
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

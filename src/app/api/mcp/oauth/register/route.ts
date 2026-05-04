import { NextRequest, NextResponse } from "next/server";
import { registerClient } from "@/lib/mcp-oauth";

/**
 * RFC 7591 — Dynamic Client Registration.
 * Claude.ai POSTs here once to obtain a client_id. We accept any redirect_uris
 * and mint a public-client record with no secret. Open registration is acceptable
 * for a single-user system because the access token issued later is what actually
 * grants privilege; client_id alone is harmless.
 */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request", error_description: "Body must be JSON" }, { status: 400, headers: corsHeaders() });
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as string[]) : [];
  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "redirect_uris is required and must be non-empty" },
      { status: 400, headers: corsHeaders() },
    );
  }

  const client = await registerClient({
    redirect_uris: redirectUris,
    client_name: typeof body.client_name === "string" ? body.client_name : undefined,
  });

  return NextResponse.json(
    {
      client_id: client.client_id,
      client_id_issued_at: Math.floor(Date.parse(client.created_at) / 1000),
      redirect_uris: client.redirect_uris,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "web",
      client_name: client.client_name,
    },
    { status: 201, headers: corsHeaders() },
  );
}

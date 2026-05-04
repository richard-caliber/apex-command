import { NextRequest, NextResponse } from "next/server";
import { consumeAuthCode, getClient, issueAccessToken, pkceVerify } from "@/lib/mcp-oauth";

const ALLOWED_SCOPE = "apex:full";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  };
}

function err(error: string, error_description: string, status = 400) {
  return NextResponse.json({ error, error_description }, { status, headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  let params: URLSearchParams;
  if (ct.includes("application/x-www-form-urlencoded")) {
    params = new URLSearchParams(await req.text());
  } else if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    params = new URLSearchParams(body as Record<string, string>);
  } else {
    return err("invalid_request", "Content-Type must be application/x-www-form-urlencoded or application/json");
  }

  const grant_type = params.get("grant_type");
  if (grant_type !== "authorization_code") {
    return err("unsupported_grant_type", "Only authorization_code is supported");
  }

  const code = params.get("code");
  const code_verifier = params.get("code_verifier");
  const redirect_uri = params.get("redirect_uri");
  const client_id = params.get("client_id");

  if (!code || !code_verifier || !redirect_uri || !client_id) {
    return err("invalid_request", "code, code_verifier, redirect_uri, and client_id are all required");
  }

  const client = await getClient(client_id);
  if (!client) return err("invalid_client", "Unknown client_id", 401);

  const record = await consumeAuthCode(code);
  if (!record) return err("invalid_grant", "Authorization code is invalid, expired, or already used");

  if (record.client_id !== client_id) return err("invalid_grant", "client_id does not match the auth code");
  if (record.redirect_uri !== redirect_uri) return err("invalid_grant", "redirect_uri does not match the auth code");
  if (!pkceVerify(code_verifier, record.code_challenge)) return err("invalid_grant", "PKCE verification failed");

  const scopes = (record.scope || ALLOWED_SCOPE).split(/\s+/).filter(Boolean);
  const token = await issueAccessToken({ client_id, scopes });

  return NextResponse.json(
    {
      access_token: token.access_token,
      token_type: "Bearer",
      scope: scopes.join(" "),
    },
    { status: 200, headers: corsHeaders() },
  );
}

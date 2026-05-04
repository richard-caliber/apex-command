import { NextRequest, NextResponse } from "next/server";
import { getApexApiToken, getClient, issueAuthCode, safeEqual } from "@/lib/mcp-oauth";

const ALLOWED_SCOPE = "apex:full";

interface AuthorizeParams {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string;
  scope: string;
}

function readParams(url: URL, form?: URLSearchParams): Partial<AuthorizeParams> {
  const get = (k: string) => form?.get(k) ?? url.searchParams.get(k) ?? undefined;
  return {
    response_type: get("response_type") ?? undefined,
    client_id: get("client_id") ?? undefined,
    redirect_uri: get("redirect_uri") ?? undefined,
    code_challenge: get("code_challenge") ?? undefined,
    code_challenge_method: get("code_challenge_method") ?? undefined,
    state: get("state") ?? undefined,
    scope: get("scope") ?? undefined,
  };
}

async function validate(params: Partial<AuthorizeParams>): Promise<{ ok: true; params: AuthorizeParams } | { ok: false; error: string }> {
  if (params.response_type !== "code") return { ok: false, error: "response_type must be 'code'" };
  if (!params.client_id) return { ok: false, error: "client_id is required" };
  if (!params.redirect_uri) return { ok: false, error: "redirect_uri is required" };
  if (!params.code_challenge) return { ok: false, error: "code_challenge is required (PKCE)" };
  if (params.code_challenge_method !== "S256") return { ok: false, error: "code_challenge_method must be S256" };

  const client = await getClient(params.client_id);
  if (!client) return { ok: false, error: "unknown client_id" };
  if (!client.redirect_uris.includes(params.redirect_uri)) return { ok: false, error: "redirect_uri not registered for this client" };

  const scope = params.scope || ALLOWED_SCOPE;
  if (scope !== ALLOWED_SCOPE) return { ok: false, error: `scope must be '${ALLOWED_SCOPE}'` };

  return {
    ok: true,
    params: {
      response_type: params.response_type!,
      client_id: params.client_id!,
      redirect_uri: params.redirect_uri!,
      code_challenge: params.code_challenge!,
      code_challenge_method: "S256",
      state: params.state ?? "",
      scope,
    },
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderForm(params: AuthorizeParams, error?: string): NextResponse {
  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Apex MCP — Authorize</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b1220; color: #e2e8f0; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 20px; }
    .card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; max-width: 480px; width: 100%; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0 0 20px; color: #94a3b8; line-height: 1.5; }
    label { display: block; font-size: 13px; color: #cbd5e1; margin-bottom: 6px; }
    input { width: 100%; padding: 10px 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; font-family: ui-monospace, monospace; font-size: 14px; box-sizing: border-box; }
    input:focus { outline: 2px solid #38bdf8; outline-offset: -1px; border-color: #38bdf8; }
    button { margin-top: 16px; width: 100%; padding: 11px; border: 0; border-radius: 8px; background: #38bdf8; color: #0b1220; font-weight: 600; cursor: pointer; font-size: 14px; }
    button:hover { background: #7dd3fc; }
    .err { background: #7f1d1d; color: #fecaca; border: 1px solid #b91c1c; padding: 10px 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
    .meta { margin-top: 18px; font-size: 12px; color: #64748b; line-height: 1.5; }
    code { background: #0f172a; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
  </style>
</head>
<body>
  <form class="card" method="POST" action="/api/mcp/oauth/authorize">
    <h1>Authorize Apex MCP</h1>
    <p>Paste your <code>APEX_API_TOKEN</code> to grant <code>${escapeHtml(params.scope)}</code> access to this client.</p>
    ${error ? `<div class="err">${escapeHtml(error)}</div>` : ""}
    <label for="apex_token">Apex API token</label>
    <input id="apex_token" name="apex_token" type="password" autocomplete="off" autofocus required />
    <input type="hidden" name="response_type" value="${escapeHtml(params.response_type)}" />
    <input type="hidden" name="client_id" value="${escapeHtml(params.client_id)}" />
    <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirect_uri)}" />
    <input type="hidden" name="code_challenge" value="${escapeHtml(params.code_challenge)}" />
    <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.code_challenge_method)}" />
    <input type="hidden" name="state" value="${escapeHtml(params.state)}" />
    <input type="hidden" name="scope" value="${escapeHtml(params.scope)}" />
    <button type="submit">Authorize</button>
    <div class="meta">Client ID: <code>${escapeHtml(params.client_id)}</code><br />Redirect: <code>${escapeHtml(params.redirect_uri)}</code></div>
  </form>
</body>
</html>`;
  return new NextResponse(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function renderError(message: string, status = 400): NextResponse {
  const body = `<!doctype html><html><head><meta charset="utf-8"><title>Apex MCP — Error</title><style>body{font-family:sans-serif;background:#0b1220;color:#fecaca;padding:32px;}code{background:#1e293b;padding:2px 6px;border-radius:3px;}</style></head><body><h1>Authorization error</h1><p>${escapeHtml(message)}</p></body></html>`;
  return new NextResponse(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = readParams(url);
  const v = await validate(params);
  if (!v.ok) return renderError(v.error);
  return renderForm(v.params);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const form = await req.formData();
  const sp = new URLSearchParams();
  for (const [k, val] of form.entries()) sp.set(k, val.toString());

  const params = readParams(url, sp);
  const v = await validate(params);
  if (!v.ok) return renderError(v.error);

  const apexToken = sp.get("apex_token") ?? "";
  let expected: string;
  try {
    expected = getApexApiToken();
  } catch {
    return renderError("APEX_API_TOKEN is not configured on the server", 500);
  }

  if (!apexToken || !safeEqual(apexToken, expected)) {
    return renderForm(v.params, "Token did not match. Try again.");
  }

  const code = await issueAuthCode({
    client_id: v.params.client_id,
    code_challenge: v.params.code_challenge,
    redirect_uri: v.params.redirect_uri,
    scope: v.params.scope,
  });

  const redirect = new URL(v.params.redirect_uri);
  redirect.searchParams.set("code", code);
  if (v.params.state) redirect.searchParams.set("state", v.params.state);
  return NextResponse.redirect(redirect.toString(), { status: 302 });
}

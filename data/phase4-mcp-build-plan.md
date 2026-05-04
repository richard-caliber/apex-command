# Phase 4 MCP build plan

## Decision: Option A — OAuth 2.1 wrapper around APEX_API_TOKEN

The Phase 4 brief originally specified Bearer-token auth via header. Pre-build research confirmed Claude.ai's consumer connector flow does not support pasting a static Bearer ([Anthropic auth reference](https://claude.com/docs/connectors/building/authentication): *"User-pasted bearer tokens (`static_bearer`) are not yet supported."*). The user chose Option A: implement OAuth 2.1 server-side with the underlying auth model unchanged (issued tokens unwrap to `APEX_API_TOKEN`).

## Stack

- **Library**: [`mcp-handler`](https://github.com/vercel/mcp-handler) v1.1.0 (Vercel's wrapper around `@modelcontextprotocol/sdk` for Next.js App Router).
- **MCP SDK**: `@modelcontextprotocol/sdk@1.26.0` (peer of mcp-handler v1.1.0).
- **Schemas**: `zod@^3` (peer of mcp-handler).
- **Transports exposed**: Streamable HTTP (`/api/mcp/mcp`) and SSE (`/api/mcp/sse`) — both via the same `[transport]` dynamic segment that mcp-handler expects. SSE is needed by claude.ai's older connector flow; Streamable HTTP is the current spec.
- **Auth**: `withMcpAuth` from `mcp-handler` with a custom `verifyToken` that looks up the access token in KV and resolves it to the underlying API token.

## Route layout

```
src/app/
├── api/
│   └── mcp/
│       ├── [transport]/
│       │   └── route.ts          # MCP server, withMcpAuth wrapper
│       └── oauth/
│           ├── authorize/
│           │   └── route.ts      # GET: render login form / POST: issue auth code
│           ├── token/
│           │   └── route.ts      # POST: exchange code for access token (PKCE)
│           └── register/
│               └── route.ts      # POST: Dynamic Client Registration (RFC 7591)
└── .well-known/
    ├── oauth-protected-resource/
    │   └── route.ts              # RFC 9728 protected-resource metadata
    └── oauth-authorization-server/
        └── route.ts              # RFC 8414 authorization-server metadata

src/lib/
├── mcp-audit.ts                  # appendAuditEvent helper
└── mcp-oauth.ts                  # auth code + access token KV plumbing
```

## OAuth flow (single-user, recommended-defaults config)

1. User adds connector in Claude.ai → "Add custom connector" → URL `https://apex-command-seven.vercel.app/api/mcp/mcp`.
2. Claude.ai fetches `/.well-known/oauth-protected-resource` on that origin → gets pointer to authorization server (same origin).
3. Claude.ai fetches `/.well-known/oauth-authorization-server` → gets `authorization_endpoint`, `token_endpoint`, `registration_endpoint`.
4. Claude.ai POSTs to `/api/mcp/oauth/register` with redirect URI `https://claude.ai/api/mcp/auth_callback`. We accept any well-formed registration, mint a `client_id`, return it. No client secret (public client per OAuth 2.1).
5. Claude.ai redirects user to `/api/mcp/oauth/authorize?response_type=code&client_id=...&redirect_uri=...&code_challenge=...&code_challenge_method=S256&state=...&scope=apex:full`.
6. We render an HTML form. **User pastes their `APEX_API_TOKEN` once** — they have it in `.env.local`. Form submits to the same endpoint via POST.
7. POST handler validates the token equals `APEX_API_TOKEN` (timing-safe compare). On success: generate authorization code (random opaque string), store `{code → {client_id, code_challenge, redirect_uri, scope, expires_at}}` in KV at `apex:mcp-oauth:codes:{code}` with 5-minute TTL. Redirect to `redirect_uri?code=...&state=...`.
8. Claude.ai POSTs to `/api/mcp/oauth/token` with `grant_type=authorization_code&code=...&code_verifier=...&redirect_uri=...&client_id=...`. We:
   - Look up code in KV; reject if missing/expired.
   - Verify PKCE: `base64url(sha256(code_verifier)) === code_challenge`.
   - Verify `redirect_uri` and `client_id` match the stored values.
   - Mint an opaque access token, store `{access_token → {client_id, scopes, issued_at}}` in KV at `apex:mcp-oauth:tokens:{access_token}` with no TTL (no-expiry per user decision).
   - Delete the auth code (single-use).
   - Return `{access_token, token_type: "Bearer", scope: "apex:full"}`.
9. From now on, every MCP request from Claude.ai has `Authorization: Bearer <access_token>`. `verifyToken` looks the token up in KV, returns `AuthInfo` with scope `apex:full`. No further OAuth interaction.

**Decided defaults** (per user confirmation):
- No expiry on access tokens. Revoke by deleting from KV (`apex:mcp-oauth:tokens:*`).
- Single scope `apex:full`.
- No refresh tokens.

## Token storage shapes (KV)

```
apex:mcp-oauth:clients:{client_id}        { client_id, redirect_uris[], created_at }
apex:mcp-oauth:codes:{code}               { client_id, code_challenge, redirect_uri, scope, expires_at }   TTL 300s
apex:mcp-oauth:tokens:{access_token}      { client_id, scopes[], issued_at }                              no TTL
apex:mcp-audit:{YYYY-MM}                  { month, events[], lastUpdated }                                 append-only
```

Access tokens are **not** APEX_API_TOKEN — they are unique opaque strings minted per OAuth flow. `verifyToken` confirms the token is in `apex:mcp-oauth:tokens:*`; tools then run with `APEX_API_TOKEN` privileges (effectively, since the MCP server is the privileged caller). This means Claude.ai never stores APEX_API_TOKEN itself — only an opaque wrapper.

## Tool implementation strategy

All tools accept structured input via zod schemas. Read tools query KV directly with the `@vercel/kv` client (matches Phase 1/2 patterns: `@vercel/kv` JSON-stringifies on `set`, parses on `get`). Write tools call the existing internal API endpoints (`/api/projects`, `/api/pipeline-tasks`, `/api/squad`, `/api/practices` — adding `/api/practices` if it doesn't exist) with `Authorization: Bearer <APEX_API_TOKEN>` so the existing auth/validation logic runs once. This keeps a single write path.

For the audit log, every write tool calls `appendAuditEvent(toolName, input, resultSummary)` from `src/lib/mcp-audit.ts` before returning. The event records: `event_id` (UUID), `timestamp`, `tool`, `input` (JSON), `result_summary` (string), `caller_user_agent` (extracted from request headers if available).

## Conflicts with the original brief

| Brief said | Reality | Resolution |
|---|---|---|
| Bearer token via header | Claude.ai connector flow doesn't support static_bearer | OAuth 2.1 wrapper, user-confirmed in chat |
| `apex:mcp-audit:{currentMonth}` | OK as specified | implemented as-is |
| Tool list and shapes | OK | implemented as-is |
| Streamable HTTP transport | mcp-handler exposes both Streamable HTTP (`/mcp`) and SSE (`/sse`) on the same `[transport]` segment | both exposed; the user picks the URL that matches Claude.ai's transport |

## Risks acknowledged

- The `/authorize` form requires the user to paste APEX_API_TOKEN once. This is a real secret entering the browser — should only happen once per claude.ai connector setup. The form is HTTPS-only and submits over POST; we never store the token server-side beyond the timing-safe equality check.
- Claude.ai's connector flow has had recent reliability issues (per [GitHub issue 215 in claude-ai-mcp](https://github.com/anthropics/claude-ai-mcp/issues/215) on the OAuth callback path). If the production OAuth flow fails for reasons outside our control, we'll surface and ask before invoking workarounds.
- Vercel function timeout is 60s on Hobby/Pro for HTTP routes. mcp-handler's `maxDuration: 60` handles this. Long-running tools (none in our list) would need adjustment.

## Sources

- [mcp-handler repo](https://github.com/vercel/mcp-handler)
- [mcp-handler AUTHORIZATION.md](https://github.com/vercel/mcp-handler/blob/main/docs/AUTHORIZATION.md)
- [Anthropic Claude.ai connector building docs](https://claude.com/docs/connectors/building)
- [Anthropic auth reference (static_bearer not supported)](https://claude.com/docs/connectors/building/authentication)
- [MCP authorization spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [run-llama/mcp-nextjs example](https://github.com/run-llama/mcp-nextjs)

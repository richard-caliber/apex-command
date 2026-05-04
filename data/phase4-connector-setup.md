# Apex MCP — Claude.ai connector setup

Add the Apex MCP server to any Claude.ai chat in five clicks. After this, every chat with the connector enabled can read your projects, tasks, agents and practices, and can mutate them through audited tool calls.

---

## What you need

- A Claude.ai Pro or Max plan (custom connectors are gated to paid tiers).
- Your `APEX_API_TOKEN` value. It's currently `apex-live-b51f4cfd5c96bead7077bbfd5080995f` (lives in `.env.local` and the three Vercel environment slots). You'll paste it once during the OAuth flow; Claude.ai then never sees the raw token again — only an opaque wrapper.

---

## Step-by-step

### 1. Open the Connectors page

In Claude.ai (web or iOS), click your avatar → **Settings** → **Customize** → **Connectors**.

### 2. Add a custom connector

Click the **+** button at the top of the connector list, then **Add custom connector**.

### 3. Paste the URL

In the **Remote MCP server URL** field, enter:

```
https://apex-command-seven.vercel.app/api/mcp/mcp
```

Leave **Advanced settings** alone — no OAuth Client ID or Client Secret needed (Apex's MCP server publishes Dynamic Client Registration metadata, so Claude.ai will mint its own client automatically).

Click **Add**.

### 4. Authorize

Claude.ai will open a popup at `apex-command-seven.vercel.app/api/mcp/oauth/authorize`. You'll see a dark form titled **"Authorize Apex MCP"** with a single password-style field labelled **Apex API token**.

Paste your `APEX_API_TOKEN` and click **Authorize**.

If the token is correct you'll be redirected back to Claude.ai with a green confirmation. If it's wrong, the same form re-renders with an error — try again.

### 5. Connector is live

Back in Connectors, the new connector should show as connected with a list of tools (`apex_list_projects`, `apex_get_briefing`, …, 14 in total). Toggle it on for any chat where you want Apex access.

---

## First test (do this immediately after setup)

Open a new chat with the connector enabled and run, in this exact order:

1. **`What apex projects are paused right now?`** — Claude should call `apex_list_projects` with `status="paused"` and return a list. If you get a list of project names with stage and blocker fields, the read path is working.
2. **`Show me today's apex briefing`** — Claude should call `apex_get_briefing` and return active projects + your open actions + agent status. If the briefing matches what you'd see in /action-room on the website, the composite read works.
3. **`Add an apex pipeline task to project edge-auto called "MCP connector verified" owned by ginge, status not_started`** — Claude should call `apex_set_task` and report a task id. Verify by reading `apex_get_audit` (or by opening the War Room) — the task should be present and the audit log should show one event.

If all three succeed, the connector is fully functional. If any fail, report back with the error message Claude returned.

---

## What's happening under the hood

- The MCP server lives at `/api/mcp/mcp` (Streamable HTTP) and `/api/mcp/sse` (legacy SSE) on the same Vercel app as the rest of Apex.
- Auth is OAuth 2.1 + PKCE + Dynamic Client Registration. Claude.ai's connector flow does the dance automatically once you paste the API token at step 4. After that, every MCP request from Claude.ai includes a unique opaque Bearer token (not your API token) which the server resolves via KV.
- All write tools log to `apex:mcp-audit:{YYYY-MM}`. To review what MCP did to your data this month, ask Claude `Show me the apex audit log`.
- Read tools query KV directly. Write tools mutate KV directly. The auth wrapper (`withMcpAuth`) checks scope on every request before the tool ever runs.

---

## Tools exposed (14 total)

**Read** (no audit log entry, idempotent):
- `apex_list_projects` — all War Room projects, optional filters
- `apex_get_project` — single project full record
- `apex_list_tasks` — pipeline tasks with filters, default top 20
- `apex_get_task` — single task full record
- `apex_get_briefing` — Briefing Room composite view
- `apex_list_agents` — agent ids, names, status (no full bodies)
- `apex_get_agent` — full agent (soul, identity, capabilities, memory, runtime_config)
- `apex_search_practices` — text/tag/category search across `apex:practices:v1` (166 items)
- `apex_get_practice` — single practice full content
- `apex_get_audit` — current month's MCP audit log

**Write** (audit-logged):
- `apex_set_task` — create or update a pipeline task
- `apex_complete_task` — mark a task done
- `apex_update_agent_memory` — append text to an agent's `memory_text`
- `apex_add_practice` — append a new item to `apex:practices:v1`

---

## Revoking a connector

If a Claude.ai client is misbehaving:
1. **Cheap revoke**: Remove the connector in Claude.ai's UI. The opaque token stays in KV but Claude.ai won't use it.
2. **Hard revoke**: Delete the matching token from KV. Find it under `apex:mcp-oauth:tokens:apex-mcp-tok-*` and `kv del`. Re-adding the connector mints a fresh one.
3. **Nuclear**: Rotate `APEX_API_TOKEN`. Every existing OAuth token still works (they don't unwrap to APEX_API_TOKEN — they're separate KV entries) but no NEW connectors can be added until you paste the new token at step 4.

---

## Known limitations

- Bearer tokens are not expiring (per Phase 4 design decisions). If you want rotation, delete the relevant `apex:mcp-oauth:tokens:*` KV key and re-run setup.
- Claude.ai's connector flow has had reliability issues since April 2026 (per [GitHub issue #215](https://github.com/anthropics/claude-ai-mcp/issues/215)). If "Add" fails with "Couldn't reach the MCP server" first time, retry — usually works on the second attempt.
- The legacy SSE transport endpoint (`/api/mcp/sse`) is exposed for backward compatibility; current Claude.ai uses the Streamable HTTP endpoint at `/api/mcp/mcp`. Don't change the URL after setup.

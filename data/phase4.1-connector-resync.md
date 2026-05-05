# Phase 4.1 — Apex Command Connector Resync

**When to run this:** after Phase 4.1 deploy on 2026-05-05, three new MCP tools (`apex_set_project`, `apex_archive_project`, `apex_update_practice`) were added. Existing chat sessions and the connector's cached tool list will not see them until claude.ai re-fetches `tools/list` from the MCP server. claude.ai hydrates the tool list at OAuth time, not per-request, so a disconnect/reconnect is required for a fresh hydration.

## Verification first

Before reconnecting, confirm the new tools are visible to the connector by looking at:
- claude.ai → Settings → Connectors → Apex Command → expand the connector card. The "Available tools" / "Tools enabled" count should jump from 14 → 17. If it already shows 17 with the three new names listed, NO RESYNC NEEDED — claude.ai may have refreshed automatically. Try the new tools in a fresh chat first.

## Resync steps (only if new tools don't surface)

1. Open https://claude.ai → top-left avatar → **Settings** → **Connectors** tab.
2. Find **Apex Command** in the list.
3. Click the connector to open it. Click **Disconnect** (or the "..." menu → Remove).
4. Confirm. Wait for the entry to disappear or show as disconnected.
5. Click **Add connector** → **Apex Command** (or paste the URL `https://apex-command-seven.vercel.app/api/mcp/mcp` if the connector entry is no longer in the directory).
6. Walk through the OAuth dialog: it pops open the Apex authorize form. Paste `APEX_API_TOKEN` (same token as before). Submit.
7. The flow completes and you bounce back to claude.ai. The connector should now show **17 tools available**, listing `apex_set_project`, `apex_archive_project`, `apex_update_practice` alongside the existing 14.

## Confirm in a chat

Open a **new chat** (do not reuse an old one — old chats keep their tool list snapshot from when the chat started). Try:

- "List all my Apex projects" — should call `apex_list_projects` (still works after the resync).
- "Create a new Apex project called 'Phase 4.1 Smoke Test' with stage validation and status active" — should call `apex_set_project`. The model should propose the call before executing; approve.
- "Archive the project you just created with reason 'no longer needed'" — should call `apex_archive_project`.

If any of these tools are not offered, the resync didn't take. Retry from step 3, or wait 10 minutes — claude.ai sometimes batches connector updates.

## Notes

- `APEX_API_TOKEN` does NOT change in Phase 4.1 — same value as Phase 4.
- The OAuth wrapper, scopes (`apex:full`), and access-token shape are unchanged.
- Existing access tokens issued before Phase 4.1 may continue to work, but the connector's tool-list cache is the limiting factor — that's what the resync refreshes.
- If the connector card never shows the new tools, fall back to the API-mode `mcp_servers` integration with the `anthropic-beta: mcp-client-2025-11-20` header — the same access token works there and the new tools surface immediately.

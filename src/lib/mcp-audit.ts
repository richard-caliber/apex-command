import { kv } from "@vercel/kv";
import { randomUUID } from "crypto";

export interface MCPAuditEvent {
  event_id: string;
  timestamp: string;
  tool: string;
  input: unknown;
  result_summary: string;
  caller_user_agent?: string;
}

export interface MCPAuditMonth {
  month: string;
  events: MCPAuditEvent[];
  lastUpdated: string;
}

export function currentMonth(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

function key(month: string): string {
  return `apex:mcp-audit:${month}`;
}

export async function getAuditMonth(month: string = currentMonth()): Promise<MCPAuditMonth> {
  const cached = await kv.get<MCPAuditMonth>(key(month));
  if (cached) return cached;
  return {
    month,
    events: [],
    lastUpdated: new Date().toISOString(),
  };
}

export async function appendAuditEvent(opts: {
  tool: string;
  input: unknown;
  resultSummary: string;
  callerUserAgent?: string;
}): Promise<MCPAuditEvent> {
  const month = currentMonth();
  const k = key(month);
  const now = new Date().toISOString();
  const existing = (await kv.get<MCPAuditMonth>(k)) ?? {
    month,
    events: [],
    lastUpdated: now,
  };
  const event: MCPAuditEvent = {
    event_id: randomUUID(),
    timestamp: now,
    tool: opts.tool,
    input: opts.input,
    result_summary: opts.resultSummary,
    caller_user_agent: opts.callerUserAgent,
  };
  existing.events.push(event);
  existing.lastUpdated = now;
  await kv.set(k, existing);
  return event;
}

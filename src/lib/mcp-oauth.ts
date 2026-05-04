import { kv } from "@vercel/kv";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

const CLIENTS_PREFIX = "apex:mcp-oauth:clients";
const CODES_PREFIX = "apex:mcp-oauth:codes";
const TOKENS_PREFIX = "apex:mcp-oauth:tokens";
const CODE_TTL_SECONDS = 300;

export interface ClientRecord {
  client_id: string;
  redirect_uris: string[];
  client_name?: string;
  created_at: string;
}

export interface AuthCodeRecord {
  code: string;
  client_id: string;
  code_challenge: string;
  code_challenge_method: "S256";
  redirect_uri: string;
  scope: string;
  expires_at: string;
}

export interface AccessTokenRecord {
  access_token: string;
  client_id: string;
  scopes: string[];
  issued_at: string;
}

function rand(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function getApexApiToken(): string {
  const t = process.env.APEX_API_TOKEN;
  if (!t) throw new Error("APEX_API_TOKEN is not configured");
  return t;
}

export function pkceVerify(verifier: string, challenge: string): boolean {
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return safeEqual(computed, challenge);
}

export async function registerClient(opts: {
  redirect_uris: string[];
  client_name?: string;
}): Promise<ClientRecord> {
  const client_id = `apex-mcp-${rand(12)}`;
  const record: ClientRecord = {
    client_id,
    redirect_uris: opts.redirect_uris,
    client_name: opts.client_name,
    created_at: new Date().toISOString(),
  };
  await kv.set(`${CLIENTS_PREFIX}:${client_id}`, record);
  return record;
}

export async function getClient(client_id: string): Promise<ClientRecord | null> {
  return kv.get<ClientRecord>(`${CLIENTS_PREFIX}:${client_id}`);
}

export async function issueAuthCode(opts: {
  client_id: string;
  code_challenge: string;
  redirect_uri: string;
  scope: string;
}): Promise<string> {
  const code = rand(24);
  const record: AuthCodeRecord = {
    code,
    client_id: opts.client_id,
    code_challenge: opts.code_challenge,
    code_challenge_method: "S256",
    redirect_uri: opts.redirect_uri,
    scope: opts.scope,
    expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(),
  };
  await kv.set(`${CODES_PREFIX}:${code}`, record, { ex: CODE_TTL_SECONDS });
  return code;
}

export async function consumeAuthCode(code: string): Promise<AuthCodeRecord | null> {
  const key = `${CODES_PREFIX}:${code}`;
  const record = await kv.get<AuthCodeRecord>(key);
  if (!record) return null;
  if (new Date(record.expires_at).getTime() < Date.now()) {
    await kv.del(key);
    return null;
  }
  await kv.del(key);
  return record;
}

export async function issueAccessToken(opts: {
  client_id: string;
  scopes: string[];
}): Promise<AccessTokenRecord> {
  const access_token = `apex-mcp-tok-${rand(32)}`;
  const record: AccessTokenRecord = {
    access_token,
    client_id: opts.client_id,
    scopes: opts.scopes,
    issued_at: new Date().toISOString(),
  };
  await kv.set(`${TOKENS_PREFIX}:${access_token}`, record);
  return record;
}

export async function lookupAccessToken(access_token: string): Promise<AccessTokenRecord | null> {
  return kv.get<AccessTokenRecord>(`${TOKENS_PREFIX}:${access_token}`);
}

export async function revokeAccessToken(access_token: string): Promise<void> {
  await kv.del(`${TOKENS_PREFIX}:${access_token}`);
}

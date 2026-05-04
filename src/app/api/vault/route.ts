import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { requireWriteAuth } from "@/lib/auth";
const KV_PREFIX = "vault:apikeys:";
const KV_INDEX = "vault:apikeys:_index";

function getEncryptionKey(): Buffer {
  const hex = process.env.VAULT_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("VAULT_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:ciphertext (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(packed: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, ctHex] = packed.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

function mask(value: string): string {
  if (value.length <= 4) return "\u2022".repeat(4);
  return "\u2022".repeat(6) + value.slice(-4);
}

/* ── IP Vault ── */
const IP_KV_KEY = "vault:ip-entries";

interface IpEntry {
  id: string;
  project_id: string;
  category: string;
  title: string;
  content: string;
  source_task: string;
  source_prompt: string;
  created_by: string;
  created_at: string;
  tags: string[];
  project_name: string;
  performance_data: Record<string, unknown> | null;
}

interface IpStore { items: IpEntry[]; lastUpdated: string }

async function getIpStore(): Promise<IpStore> {
  const cached = await kv.get<IpStore>(IP_KV_KEY);
  if (cached) return cached;
  const seed: IpStore = { items: [], lastUpdated: new Date().toISOString() };
  await kv.set(IP_KV_KEY, seed);
  return seed;
}

async function saveIpStore(store: IpStore) {
  store.lastUpdated = new Date().toISOString();
  await kv.set(IP_KV_KEY, store);
}

/* ── API Keys ── */
interface StoredKey {
  id: string;
  name: string;
  service: string;
  encrypted_value: string;
  updated_at: string;
}

interface IndexEntry {
  id: string;
  name: string;
  service: string;
  masked: string;
  updated_at: string;
}

export async function POST(req: NextRequest) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {
      case "list": {
        const index = await kv.get<IndexEntry[]>(KV_INDEX);
        return NextResponse.json(index || []);
      }

      case "get": {
        const { id } = body;
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const stored = await kv.get<StoredKey>(`${KV_PREFIX}${id}`);
        if (!stored) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const value = decrypt(stored.encrypted_value);
        return NextResponse.json({ id: stored.id, name: stored.name, service: stored.service, value, updated_at: stored.updated_at });
      }

      case "set": {
        const { id, name, service, value } = body;
        if (!id || !name || !value) {
          return NextResponse.json({ error: "id, name, and value required" }, { status: 400 });
        }

        const now = new Date().toISOString();
        const encrypted_value = encrypt(value);
        const stored: StoredKey = { id, name, service: service || "", encrypted_value, updated_at: now };
        await kv.set(`${KV_PREFIX}${id}`, stored);

        // Update index
        const index = (await kv.get<IndexEntry[]>(KV_INDEX)) || [];
        const existing = index.findIndex((e) => e.id === id);
        const entry: IndexEntry = { id, name, service: service || "", masked: mask(value), updated_at: now };
        if (existing >= 0) {
          index[existing] = entry;
        } else {
          index.push(entry);
        }
        await kv.set(KV_INDEX, index);

        return NextResponse.json({ ok: true });
      }

      case "delete": {
        const { id: delId } = body;
        if (!delId) return NextResponse.json({ error: "id required" }, { status: 400 });
        await kv.del(`${KV_PREFIX}${delId}`);

        const idx = (await kv.get<IndexEntry[]>(KV_INDEX)) || [];
        const filtered = idx.filter((e) => e.id !== delId);
        await kv.set(KV_INDEX, filtered);

        return NextResponse.json({ ok: true });
      }

      case "verify-password": {
        const { password } = body;
        const storedHash = process.env.VAULT_PASSWORD_HASH;
        if (!storedHash) return NextResponse.json({ error: "Vault not configured" }, { status: 500 });

        const crypto = await import("crypto");
        const [salt, hash] = storedHash.split(":");
        const verify = crypto.scryptSync(password, salt, 64).toString("hex");
        const valid = verify === hash;
        return NextResponse.json({ valid });
      }

      /* ── IP Vault actions ── */
      case "ip-list": {
        const store = await getIpStore();
        let items = store.items;
        if (body.project_id) items = items.filter((i) => i.project_id === body.project_id);
        if (body.category) items = items.filter((i) => i.category === body.category);
        return NextResponse.json({ items, lastUpdated: store.lastUpdated });
      }

      case "ip-get": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const store = await getIpStore();
        const item = store.items.find((i) => i.id === body.id);
        if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(item);
      }

      case "ip-set": {
        const { id: ipId, ...ipFields } = body;
        if (!ipId) return NextResponse.json({ error: "id required" }, { status: 400 });
        const store = await getIpStore();
        const now = new Date().toISOString();
        const idx = store.items.findIndex((i) => i.id === ipId);
        if (idx >= 0) {
          const { action: _a, ...clean } = ipFields;
          store.items[idx] = { ...store.items[idx], ...clean, id: ipId };
        } else {
          store.items.push({
            id: ipId,
            project_id: ipFields.project_id || "",
            category: ipFields.category || "research",
            title: ipFields.title || "",
            content: ipFields.content || "",
            source_task: ipFields.source_task || "",
            source_prompt: ipFields.source_prompt || "",
            created_by: ipFields.created_by || "atlas",
            created_at: now,
            tags: ipFields.tags || [],
            project_name: ipFields.project_name || "",
            performance_data: ipFields.performance_data || null,
          });
        }
        await saveIpStore(store);
        return NextResponse.json(store.items.find((i) => i.id === ipId));
      }

      case "ip-delete": {
        if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const store = await getIpStore();
        store.items = store.items.filter((i) => i.id !== body.id);
        await saveIpStore(store);
        return NextResponse.json({ ok: true });
      }

      case "ip-search": {
        const { query: q } = body;
        if (!q) return NextResponse.json({ items: [] });
        const store = await getIpStore();
        const lower = q.toLowerCase();
        const results = store.items.filter((i) =>
          i.title.toLowerCase().includes(lower) ||
          i.content.toLowerCase().includes(lower) ||
          i.tags.some((t: string) => t.toLowerCase().includes(lower))
        );
        return NextResponse.json({ items: results });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

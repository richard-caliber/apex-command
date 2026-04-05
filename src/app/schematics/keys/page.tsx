"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

const TOKEN = "apex-live-2026";

/* ── Types ── */
interface VaultKey { id: string; name: string; service: string; masked: string; updated_at: string }

function vaultApi(body: Record<string, unknown>) {
  return fetch("/api/vault", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

/* ── Session ── */
const VAULT_TIMEOUT_MS = 30 * 60 * 1000;
const VAULT_TS_KEY = "vault_unlock_ts";
function isSessionValid() { const ts = sessionStorage.getItem(VAULT_TS_KEY); return ts ? Date.now() - parseInt(ts, 10) < VAULT_TIMEOUT_MS : false; }
function touchSession() { sessionStorage.setItem(VAULT_TS_KEY, Date.now().toString()); }

/* ── Main ── */
export default function VaultPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setUnlocked(isSessionValid());
    if (!isSessionValid()) sessionStorage.removeItem(VAULT_TS_KEY);
    setChecking(false);
  }, []);

  if (checking) return null;

  return (
    <div>
      {unlocked ? <VaultContents onActivity={touchSession} /> : <PasswordGate onUnlock={() => { touchSession(); setUnlocked(true); }} />}
    </div>
  );
}

/* ── Password Gate ── */
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const submit = async () => {
    if (!password.trim() || loading) return;
    setLoading(true); setError(false);
    try {
      const data = await vaultApi({ action: "verify-password", password });
      if (data.valid) { onUnlock(); } else { setError(true); setShake(true); setTimeout(() => setShake(false), 600); setPassword(""); inputRef.current?.focus(); }
    } catch { setError(true); setShake(true); setTimeout(() => setShake(false), 600); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center space-y-6" style={{ animation: shake ? "shake 0.5s ease-in-out" : "none" }}>
        <div className="text-6xl opacity-60">{"\u{1F512}"}</div>
        <div><h2 className="text-xl font-bold text-white mb-1">Vault Locked</h2><p className="text-sm text-[#64748b]">Enter password to access</p></div>
        <div className="flex items-center gap-2 max-w-xs mx-auto">
          <input ref={inputRef} type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Password"
            className={`flex-1 bg-[#111827] border rounded-lg px-4 py-3 text-sm text-white focus:outline-none ${error ? "border-red-500" : "border-[#1e293b] focus:border-[#00d4d4]"}`} />
          <button onClick={submit} disabled={loading} className="px-4 py-3 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50"
            style={{ background: "rgba(0,212,212,0.1)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.3)" }}>{loading ? "..." : "Unlock"}</button>
        </div>
        {error && <p className="text-xs text-red-400">Wrong password</p>}
        <style jsx>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }`}</style>
      </div>
    </div>
  );
}

/* ── Vault Contents — API Keys only ── */
function VaultContents({ onActivity }: { onActivity: () => void }) {
  return (
    <main className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white">{"\u{1F510}"} Keys</h2>
        <p className="text-sm mt-1" style={{ color: "#64748b" }}>Encrypted API key storage. 30-min session timeout.</p>
      </div>
      <ApiKeysCard onActivity={onActivity} />
    </main>
  );
}

/* ── API Keys Card (preserved from original) ── */
function ApiKeysCard({ onActivity }: { onActivity: () => void }) {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<VaultKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState({ id: "", name: "", service: "", value: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try { const res = await vaultApi({ action: "list" }); setKeys(res || []); } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) fetchKeys(); }, [open, fetchKeys]);

  const revealKey = async (id: string) => {
    onActivity();
    try {
      const data = await vaultApi({ action: "get", id });
      if (data.value) { setRevealedId(id); setRevealedValue(data.value); setTimeout(() => { setRevealedId(null); setRevealedValue(""); }, 10000); }
    } catch { /* */ }
  };

  const saveKey = async () => {
    if (!newKey.id || !newKey.name || !newKey.value) return;
    onActivity();
    await vaultApi({ action: "set", ...newKey });
    setNewKey({ id: "", name: "", service: "", value: "" }); setAdding(false); fetchKeys();
  };

  const deleteKey = async (id: string) => {
    onActivity();
    await vaultApi({ action: "delete", id });
    setDeleteConfirm(null); fetchKeys();
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "rgba(17,24,39,0.85)", borderColor: "#1e293b" }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors">
        <span className="text-lg">{"\u{1F510}"}</span>
        <span className="text-sm font-bold text-white flex-1 text-left">API Keys</span>
        <span className="text-xs font-mono" style={{ color: "#475569" }}>{keys.length > 0 ? `${keys.length} stored` : ""}</span>
        <span className="text-xs" style={{ color: "#475569" }}>{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div className="border-t px-5 pb-5" style={{ borderColor: "#1e293b" }}>
          {loading ? <p className="text-sm py-4 text-center" style={{ color: "#475569" }}>Loading...</p>
          : keys.length === 0 && !adding ? (
            <div className="py-6 text-center"><p className="text-sm italic mb-3" style={{ color: "#475569" }}>No API keys stored</p>
              <button onClick={() => setAdding(true)} className="text-xs hover:underline cursor-pointer" style={{ color: "#00d4d4" }}>+ Add first key</button></div>
          ) : (
            <div className="space-y-2 mt-3">
              {keys.map((k) => (
                <div key={k.id} className="rounded-lg border px-4 py-3" style={{ borderColor: "#1e293b" }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{k.name}</span>
                        {k.service && <span className="text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full" style={{ color: "#64748b", background: "#1e293b" }}>{k.service}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs" style={{ color: "#94a3b8" }}>{revealedId === k.id ? revealedValue : k.masked}</span>
                        {revealedId === k.id && <button onClick={() => navigator.clipboard.writeText(revealedValue)} className="text-[9px] hover:underline cursor-pointer" style={{ color: "#00d4d4" }}>Copy</button>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {revealedId !== k.id
                        ? <button onClick={() => revealKey(k.id)} className="text-[10px] hover:underline cursor-pointer" style={{ color: "#00d4d4" }}>Reveal</button>
                        : <button onClick={() => { setRevealedId(null); setRevealedValue(""); }} className="text-[10px] hover:underline cursor-pointer" style={{ color: "#475569" }}>Hide</button>}
                      {deleteConfirm === k.id
                        ? <><button onClick={() => deleteKey(k.id)} className="text-[10px] font-semibold cursor-pointer" style={{ color: "#ef4444" }}>Confirm</button><button onClick={() => setDeleteConfirm(null)} className="text-[10px] cursor-pointer" style={{ color: "#475569" }}>Cancel</button></>
                        : <button onClick={() => setDeleteConfirm(k.id)} className="text-[10px] cursor-pointer hover:text-red-400" style={{ color: "#475569" }}>Delete</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {adding ? (
            <div className="mt-4 rounded-lg border p-4 space-y-3" style={{ borderColor: "#1e293b" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input value={newKey.id} onChange={(e) => setNewKey({ ...newKey, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="Key ID" className="text-sm bg-[#0a0e1a] border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-[#00d4d4]" style={{ borderColor: "#1e293b" }} />
                <input value={newKey.name} onChange={(e) => setNewKey({ ...newKey, name: e.target.value })} placeholder="Display name" className="text-sm bg-[#0a0e1a] border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00d4d4]" style={{ borderColor: "#1e293b" }} />
                <input value={newKey.service} onChange={(e) => setNewKey({ ...newKey, service: e.target.value })} placeholder="Service" className="text-sm bg-[#0a0e1a] border rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#00d4d4]" style={{ borderColor: "#1e293b" }} />
                <input value={newKey.value} onChange={(e) => setNewKey({ ...newKey, value: e.target.value })} placeholder="API key value" type="password" className="text-sm bg-[#0a0e1a] border rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-[#00d4d4]" style={{ borderColor: "#1e293b" }} />
              </div>
              <div className="flex gap-2">
                <button onClick={saveKey} className="px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer" style={{ background: "rgba(0,212,212,0.1)", color: "#00d4d4", border: "1px solid rgba(0,212,212,0.3)" }}>Save Key</button>
                <button onClick={() => { setAdding(false); setNewKey({ id: "", name: "", service: "", value: "" }); }} className="px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer" style={{ color: "#64748b", border: "1px solid #1e293b" }}>Cancel</button>
              </div>
            </div>
          ) : keys.length > 0 ? <button onClick={() => setAdding(true)} className="mt-3 text-xs cursor-pointer hover:text-[#00d4d4]" style={{ color: "#475569" }}>+ Add key</button> : null}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";

export function useAuth() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setAuthed(sessionStorage.getItem("apex-auth") === "1");
    setChecking(false);
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      sessionStorage.setItem("apex-auth", "1");
      setAuthed(true);
      return true;
    }
    return false;
  }, []);

  return { authed, checking, login };
}

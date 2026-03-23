"use client";

import useSWR from "swr";
import type { DashboardData } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useDashboard() {
  return useSWR<DashboardData>("/api/status", fetcher, { refreshInterval: 60000 });
}

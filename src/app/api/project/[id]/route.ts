import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";
interface ProjectTask {
  id: string;
  text: string;
  owner: string;
  priority: "red" | "amber" | "green";
  status: "todo" | "in-progress" | "done" | "blocked";
  blockedBy?: string;
}

interface TimelineMilestone {
  name: string;
  date: string;
  status: "done" | "in-progress" | "upcoming";
}

interface WaitingItem {
  text: string;
  owner: string;
}

interface ProjectDetail {
  id: string;
  tasks: ProjectTask[];
  timeline: TimelineMilestone[];
  waitingOn: WaitingItem[];
  notes?: string;
}

const SEED: Record<string, ProjectDetail> = {
  caliber: {
    id: "caliber",
    tasks: [
      { id: "t1", text: "Website rebuild with sales copy + conversion fixes", owner: "🧭", priority: "red", status: "in-progress" },
      { id: "t2", text: "Connect NOWPayments for crypto checkout", owner: "👤", priority: "red", status: "todo" },
      { id: "t3", text: "Add real wallet addresses to checkout", owner: "👤", priority: "red", status: "todo" },
      { id: "t4", text: "Change IG bio link to website", owner: "👤", priority: "red", status: "todo" },
      { id: "t5", text: "TG sales bot — update with protocol framing", owner: "🧭", priority: "amber", status: "todo" },
      { id: "t6", text: "Peptide Sciences alternative SEO content", owner: "🔬", priority: "amber", status: "todo" },
      { id: "t7", text: "First real sale", owner: "🧭", priority: "red", status: "todo" },
    ],
    timeline: [
      { name: "Website Live", date: "2026-03-30", status: "in-progress" },
      { name: "First Sale", date: "2026-04-05", status: "upcoming" },
      { name: "10 Orders", date: "2026-04-15", status: "upcoming" },
      { name: "Full Automation", date: "2026-05-01", status: "upcoming" },
    ],
    waitingOn: [
      { text: "Connect NOWPayments", owner: "👤" },
      { text: "Add real crypto wallet addresses", owner: "👤" },
      { text: "Change IG bio link to website", owner: "👤" },
    ],
    notes: "",
  },
  gemsnap: {
    id: "gemsnap",
    tasks: [
      { id: "t1", text: "Wait for 48h PostHog session data", owner: "⏳", priority: "green", status: "in-progress" },
      { id: "t2", text: "Review session recordings + fix funnel", owner: "🧭", priority: "amber", status: "blocked", blockedBy: "Need 48h of PostHog data first" },
      { id: "t3", text: "Verify phone on Meta ad account", owner: "👤", priority: "red", status: "todo" },
    ],
    timeline: [
      { name: "PostHog Live", date: "2026-03-29", status: "done" },
      { name: "First Real Customer", date: "2026-04-07", status: "upcoming" },
      { name: "$100 MRR", date: "2026-04-30", status: "upcoming" },
    ],
    waitingOn: [
      { text: "Verify phone on Meta ad account", owner: "👤" },
      { text: "48h PostHog data", owner: "⏳" },
    ],
    notes: "",
  },
  "edge-auto": {
    id: "edge-auto",
    tasks: [
      { id: "t1", text: "Landing page rebuild (conversion-focused)", owner: "🧭", priority: "red", status: "in-progress" },
      { id: "t2", text: "Add richard@edgeautomate.org to phone", owner: "👤", priority: "red", status: "todo" },
      { id: "t3", text: "Test booking page end-to-end", owner: "👤", priority: "red", status: "todo" },
      { id: "t4", text: "Close Todd + onboard Josh", owner: "👤", priority: "amber", status: "todo" },
    ],
    timeline: [
      { name: "Landing Page Live", date: "2026-03-30", status: "in-progress" },
      { name: "First Client (Todd)", date: "2026-04-07", status: "upcoming" },
      { name: "5 Clients", date: "2026-05-15", status: "upcoming" },
      { name: "Raise to $8K", date: "2026-06-01", status: "upcoming" },
    ],
    waitingOn: [
      { text: "Add email to phone", owner: "👤" },
      { text: "Test booking page", owner: "👤" },
    ],
    notes: "",
  },
  storyquest: {
    id: "storyquest",
    tasks: [
      { id: "t1", text: "Wire Stripe paywall (handleSubscribe)", owner: "👤", priority: "red", status: "todo" },
      { id: "t2", text: "Add SFX audio files to /public/audio/sfx/", owner: "👤", priority: "amber", status: "todo" },
      { id: "t3", text: "Integrate Gemini Flash Live TTS", owner: "👤", priority: "amber", status: "todo" },
      { id: "t4", text: "Generate book cover images for bookshelf", owner: "👤", priority: "green", status: "todo" },
    ],
    timeline: [
      { name: "AI Engine Built", date: "2026-03-20", status: "done" },
      { name: "Stripe + Paywall", date: "2026-04-05", status: "upcoming" },
      { name: "Public Launch", date: "2026-04-15", status: "upcoming" },
      { name: "100 Users", date: "2026-05-01", status: "upcoming" },
    ],
    waitingOn: [
      { text: "Wire Stripe paywall", owner: "👤" },
      { text: "Source SFX audio files", owner: "👤" },
    ],
    notes: "",
  },
  villas: {
    id: "villas",
    tasks: [
      { id: "t1", text: "Villa investor page (Antigravity build)", owner: "👤", priority: "amber", status: "todo" },
      { id: "t2", text: "Email top 4 Phuket agencies with prospectus", owner: "🧭", priority: "amber", status: "todo" },
    ],
    timeline: [
      { name: "Listings Live", date: "2026-03-15", status: "done" },
      { name: "Agent Outreach", date: "2026-04-01", status: "upcoming" },
      { name: "First Viewing", date: "2026-04-30", status: "upcoming" },
    ],
    waitingOn: [
      { text: "Build investor page", owner: "👤" },
    ],
    notes: "",
  },
  parliament: {
    id: "parliament",
    tasks: [
      { id: "t1", text: "Email capture landing page (Antigravity)", owner: "👤", priority: "green", status: "todo" },
      { id: "t2", text: "Newton feasibility report", owner: "🔬", priority: "green", status: "todo" },
    ],
    timeline: [
      { name: "Research Phase", date: "2026-03-29", status: "in-progress" },
      { name: "Feasibility Decision", date: "2026-04-15", status: "upcoming" },
      { name: "MVP Build", date: "2026-05-01", status: "upcoming" },
    ],
    waitingOn: [
      { text: "Newton feasibility report", owner: "⏳" },
    ],
    notes: "",
  },
  repostai: {
    id: "repostai",
    tasks: [
      { id: "t1", text: "Schedule Product Hunt launch date", owner: "👤", priority: "red", status: "todo" },
      { id: "t2", text: "Build landing page with email capture", owner: "🧭", priority: "red", status: "in-progress" },
      { id: "t3", text: "Meta ads campaign", owner: "🧭", priority: "amber", status: "todo" },
    ],
    timeline: [
      { name: "Landing Page Live", date: "2026-04-05", status: "upcoming" },
      { name: "Product Hunt Launch", date: "2026-04-15", status: "upcoming" },
      { name: "First 100 Users", date: "2026-05-01", status: "upcoming" },
    ],
    waitingOn: [
      { text: "Schedule Product Hunt launch date", owner: "👤" },
    ],
    notes: "",
  },
  squad: {
    id: "squad",
    tasks: [
      { id: "t1", text: "Dev-browser Chrome extension setup", owner: "👤", priority: "amber", status: "todo" },
      { id: "t2", text: "Explore Antigravity for landing page pipeline", owner: "🧭", priority: "green", status: "todo" },
      { id: "t3", text: "Inter-bot comms reliability fix", owner: "🧭", priority: "green", status: "todo" },
    ],
    timeline: [
      { name: "3 Bots Active", date: "2026-03-20", status: "done" },
      { name: "Pipeline Automated", date: "2026-03-25", status: "done" },
      { name: "Full Autonomy", date: "2026-05-01", status: "upcoming" },
    ],
    waitingOn: [
      { text: "Chrome extension setup for dev-browser", owner: "👤" },
    ],
    notes: "",
  },
};

function kvKey(id: string) {
  return `apex:project:${id}`;
}

async function getData(id: string): Promise<ProjectDetail | null> {
  const cached = await kv.get<ProjectDetail>(kvKey(id));
  if (cached) return cached;

  if (SEED[id]) {
    await kv.set(kvKey(id), SEED[id]);
    return SEED[id];
  }

  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;

  const { id } = await params;
  const existing = await getData(id);
  const updates = await req.json();

  const merged = existing ? { ...existing, ...updates, id } : { id, ...updates };
  await kv.set(kvKey(id), merged);
  return NextResponse.json(merged);
}

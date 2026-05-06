import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { requireWriteAuth } from "@/lib/auth";

const KV_KEY = "apex:pipeline";
const platforms = ["ig_carousel", "ig_reel", "fb_post", "tiktok", "youtube"] as const;
const gates = ["research", "review_research", "create_content", "review_content", "publish"] as const;

function makeGrid() {
  const grid: Record<string, Record<string, { status: string; agent: string; timestamp?: string; error?: string }>> = {};
  for (const gate of gates) {
    grid[gate] = {};
    for (const plat of platforms) {
      grid[gate][plat] = { status: "pending", agent: "" };
    }
  }
  return grid;
}

const SEED = {
  accounts: [
    {
      id: "caliber",
      name: "Caliber Peptides",
      handle: "@caliber.peptides",
      active: true,
      today: {
        date: "2026-03-29",
        topic: "Thymosin Alpha-1",
        grid: (() => {
          const g = makeGrid();
          // IG carousel — fully done
          g.research.ig_carousel = { status: "done", agent: "🔬", timestamp: "09:00" };
          g.review_research.ig_carousel = { status: "done", agent: "🔄", timestamp: "09:10" };
          g.create_content.ig_carousel = { status: "done", agent: "🧭", timestamp: "09:20" };
          g.review_content.ig_carousel = { status: "done", agent: "🔄", timestamp: "09:30" };
          g.publish.ig_carousel = { status: "done", agent: "🧭", timestamp: "09:40" };
          // IG reel — fully done
          g.research.ig_reel = { status: "done", agent: "🔬", timestamp: "09:00" };
          g.review_research.ig_reel = { status: "done", agent: "🔄", timestamp: "09:10" };
          g.create_content.ig_reel = { status: "done", agent: "🧭", timestamp: "09:50" };
          g.review_content.ig_reel = { status: "done", agent: "🔄", timestamp: "10:00" };
          g.publish.ig_reel = { status: "done", agent: "🧭", timestamp: "10:10" };
          // FB — research done, rest pending
          g.research.fb_post = { status: "done", agent: "🔬", timestamp: "09:00" };
          g.review_research.fb_post = { status: "done", agent: "🔄", timestamp: "09:10" };
          // TikTok/YouTube — pending
          return g;
        })(),
      },
      topics: [
        { date: "2026-03-20", name: "BPC-157", format: "carousel", status: "published", summary: "Healing peptide — gut lining, tendons, ligaments. Mechanism: upregulates growth factor expression, promotes angiogenesis." },
        { date: "2026-03-21", name: "Peptides 101", format: "carousel", status: "published", summary: "Intro to peptides — what they are, how they work, why they matter. Foundation content for new followers." },
        { date: "2026-03-23", name: "TB-500", format: "carousel", status: "published", summary: "Recovery peptide — muscle repair, inflammation reduction. Mechanism: upregulates actin, promotes cell migration." },
        { date: "2026-03-24", name: "GHK-Cu", format: "carousel", status: "published", summary: "Skin & longevity peptide — collagen synthesis, wound healing. Mechanism: copper binding, gene expression modulation." },
        { date: "2026-03-25", name: "GHK-Cu", format: "reel", status: "published", summary: "Visual reel — GHK-Cu skin transformation, molecular animation, voiceover explaining copper peptide mechanism." },
        { date: "2026-03-27", name: "Epithalon", format: "carousel", status: "published", summary: "Longevity peptide — telomere extension, pineal gland activation. Mechanism: telomerase activation, melatonin regulation." },
        { date: "2026-03-27", name: "Epithalon", format: "reel", status: "published", summary: "Reel — Epithalon 'the immortality peptide', cosmic visuals, telomere animation." },
        { date: "2026-03-28", name: "Thymosin Alpha-1", format: "carousel", status: "published", summary: "Immune peptide — T-cell activation, immune modulation. Used in cancer immunotherapy protocols." },
        { date: "2026-03-28", name: "Thymosin Alpha-1", format: "reel", status: "published", summary: "Reel — TA-1 immune system visual, white blood cell activation sequence." },
        { date: "2026-03-30", name: "DSIP", format: "reel", status: "scheduled", summary: "The Sleep Peptide — delta sleep-inducing peptide. Mechanism: modulates sleep architecture, reduces cortisol." },
        { date: "2026-03-31", name: "KPV", format: "carousel", status: "scheduled", summary: "The Gut Peptide — anti-inflammatory tripeptide. Mechanism: inhibits NF-kB, reduces mucosal inflammation." },
        { date: "2026-04-01", name: "RFK Peptide Reclassification", format: "carousel", status: "scheduled", summary: "⚠️ TIME SENSITIVE — RFK Jr. FDA peptide reclassification news. Impact on BPC-157, thymosin, GHK-Cu availability.", timeSensitive: true },
        { date: "2026-04-02", name: "Semaglutide", format: "reel", status: "scheduled", summary: "The Hunger Switch — GLP-1 receptor agonist. Mechanism: appetite suppression, insulin sensitization, gastric emptying delay." },
        { date: "2026-04-03", name: "Peptide Stack 101", format: "carousel", status: "queued", summary: "How to combine peptides for synergistic effects. Popular stacks: BPC-157+TB-500, GHK-Cu+Epithalon." },
        { date: "2026-04-04", name: "MOTS-C", format: "reel", status: "queued", summary: "Exercise in a Syringe — mitochondrial peptide. Mechanism: AMPK activation, metabolic regulation, fat oxidation." },
      ],
    },
    {
      id: "gemsnap",
      name: "GemSnap",
      handle: "@gemsnap.ai",
      active: false,
      today: { date: "2026-03-29", topic: "", grid: makeGrid() },
      topics: [],
    },
    {
      id: "edge-auto",
      name: "Edge Auto",
      handle: "@edgeautomate",
      active: false,
      today: { date: "2026-03-29", topic: "", grid: makeGrid() },
      topics: [],
    },
  ],
};

async function getData() {
  const cached = await kv.get<typeof SEED>(KV_KEY);
  if (cached) return cached;
  await kv.set(KV_KEY, SEED);
  return SEED;
}

export { getData, KV_KEY };

export async function GET() {
  return NextResponse.json(await getData());
}

export async function POST(req: NextRequest) {
  const unauthorized = requireWriteAuth(req);

  if (unauthorized) return unauthorized;
  const body = await req.json();
  await kv.set(KV_KEY, body);

  // Auto-snapshot each account's grid to history
  if (body.accounts) {
    for (const acc of body.accounts) {
      if (acc.today?.date && acc.today?.grid) {
        const historyKey = `apex:pipeline:${acc.id}:${acc.today.date}`;
        await kv.set(historyKey, { topic: acc.today.topic, grid: acc.today.grid });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

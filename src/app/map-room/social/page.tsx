"use client";

import { useState, useCallback, useMemo } from "react";

/* ── Design Tokens ── */
const C = {
  bg: "#0a0a0f",
  card: "#111118",
  border: "#1e1e2e",
  accent: "#00d4d4",
  warn: "#f59e0b",
  error: "#ef4444",
  success: "#22c55e",
  heading: "#ffffff",
  body: "#a0a0b0",
  muted: "#6b6b80",
};

const TOKEN = "apex-live-2026";

/* ── Types ── */
type PostTag = "winner" | "test" | "flop" | "none";

interface PostReview {
  score: number;
  notes: string;
  reviewedBy: string;
}

interface HousekeepingChecklist {
  formatCorrect: boolean;
  subtitlesReadable: boolean;
  ttsVoicePresent: boolean;
  thumbnailClear: boolean;
  brandingConsistent: boolean;
  ctaAppropriate: boolean;
}

interface Post {
  post_id: string;
  platform: "instagram" | "tiktok" | "reddit" | "x" | "youtube";
  project: string;
  linked_stage: string;
  hook: string;
  angle: string;
  cta_type: "hard" | "soft" | "value-only" | "engagement";
  owner: string;
  status: "planned" | "drafted" | "reviewed" | "scheduled" | "posted" | "analyzed";
  reviewed: boolean;
  posted: boolean;
  post_url: string;
  performance: string;
  created_at: string;
  // New fields
  nextAction: string;
  qualityScore: number;
  tag: PostTag;
  review: PostReview;
  scriptPrompt: string;
  visualPrompt: string;
  outputText: string;
  housekeeping: HousekeepingChecklist;
}

interface PlatformRule {
  platform_id: string;
  platform_name: string;
  format_rules: string;
  housekeeping_rules: string;
  voice_tts: string;
  subtitle_rules: string;
  thumbnail_rules: string;
  cta_rules: string;
  branding_rules: string;
  bot_mistakes: string;
}

interface PromptBlock {
  id: string;
  platform_id: string;
  type: "base-creation" | "housekeeping-checklist" | "review" | "improvement";
  version: string;
  prompt_text: string;
}

/* ── Platform Icons ── */
const PLATFORM_ICON: Record<string, string> = {
  instagram: "\uD83D\uDCF7",
  tiktok: "\uD83C\uDFB5",
  reddit: "\uD83E\uDD16",
  x: "\uD835\uDD4F",
  youtube: "\u25B6\uFE0F",
};

const PLATFORM_COLOR: Record<string, string> = {
  instagram: "#E1306C",
  tiktok: "#00f2ea",
  reddit: "#FF4500",
  x: "#1DA1F2",
  youtube: "#FF0000",
};

const STATUS_COLOR: Record<string, string> = {
  planned: C.muted,
  drafted: C.warn,
  reviewed: C.accent,
  scheduled: "#8b5cf6",
  posted: C.success,
  analyzed: "#3b82f6",
};

const CTA_BADGE: Record<string, { label: string; color: string }> = {
  hard: { label: "Hard CTA", color: C.error },
  soft: { label: "Soft CTA", color: C.warn },
  "value-only": { label: "Value Only", color: C.success },
  engagement: { label: "Engagement", color: C.accent },
};

const TAG_CONFIG: Record<PostTag, { label: string; color: string }> = {
  winner: { label: "Winner", color: C.success },
  test: { label: "Test", color: C.warn },
  flop: { label: "Flop", color: C.error },
  none: { label: "No Tag", color: C.muted },
};

const DEFAULT_HOUSEKEEPING: HousekeepingChecklist = {
  formatCorrect: false,
  subtitlesReadable: false,
  ttsVoicePresent: false,
  thumbnailClear: false,
  brandingConsistent: false,
  ctaAppropriate: false,
};

/* ── Seed Data ── */
const SEED_POSTS: Post[] = [
  {
    post_id: "POST-001",
    platform: "instagram",
    project: "caliber",
    linked_stage: "content-creation",
    hook: "This peptide reverses 10 years of joint damage",
    angle: "Education \u2014 BPC-157 mechanism of action",
    cta_type: "soft",
    owner: "Atlas",
    status: "posted",
    reviewed: true,
    posted: true,
    post_url: "https://instagram.com/p/example1",
    performance: "1,247 reach | 89 saves | 4.2% engagement",
    created_at: "2026-03-25T10:00:00Z",
    nextAction: "Analyze performance and create variation if engagement >3%",
    qualityScore: 8,
    tag: "winner",
    review: { score: 8, notes: "Strong hook, good educational value. CTA could be slightly more specific.", reviewedBy: "Darwin" },
    scriptPrompt: "You are a world-class short-form content creator for Caliber Peptides. Create an Instagram Reel about BPC-157 joint healing.\n\nRequirements:\n- Hook: curiosity gap about joint damage reversal\n- 25 second duration\n- Educational tone\n- Voice-over with timing markers\n- CTA: 'Save this for later'",
    visualPrompt: "Scene 1: Close-up of person gripping knee in pain (1-3s)\nScene 2: Animated molecule graphic with teal glow (4-10s)\nScene 3: B-roll of athletic movement, smooth joints (11-20s)\nScene 4: Brand card with CTA text overlay (21-25s)\n\nStyle: Dark teal background, white text, scientific but accessible",
    outputText: "This peptide reverses 10 years of joint damage. BPC-157 accelerates tendon and ligament healing by stimulating growth factors. Clinical research shows significant improvement in just 4-6 weeks. Save this for later.",
    housekeeping: { formatCorrect: true, subtitlesReadable: true, ttsVoicePresent: true, thumbnailClear: true, brandingConsistent: true, ctaAppropriate: true },
  },
  {
    post_id: "POST-002",
    platform: "instagram",
    project: "caliber",
    linked_stage: "content-creation",
    hook: "Why your gym recovery takes 3x longer than it should",
    angle: "Pain point \u2014 slow recovery without peptides",
    cta_type: "value-only",
    owner: "Atlas",
    status: "reviewed",
    reviewed: true,
    posted: false,
    post_url: "",
    performance: "",
    created_at: "2026-03-28T09:00:00Z",
    nextAction: "Schedule for posting on March 31 at 6PM",
    qualityScore: 7,
    tag: "test",
    review: { score: 7, notes: "Good pain-point angle. Consider adding more specific data points about recovery time.", reviewedBy: "Darwin" },
    scriptPrompt: "Create an Instagram Reel about slow gym recovery and how peptides accelerate it.\n\nHook: Make viewer feel seen about their slow recovery\nDuration: 20 seconds\nTone: Empathetic then solution-focused\nCTA: Value-only, no direct sell",
    visualPrompt: "Scene 1: Person struggling to get out of bed, DOMS visible (1-3s)\nScene 2: Split-screen before/after recovery timeline (4-12s)\nScene 3: Product shot with science overlay (13-18s)\nScene 4: Simple end card (19-20s)",
    outputText: "",
    housekeeping: { formatCorrect: true, subtitlesReadable: true, ttsVoicePresent: true, thumbnailClear: false, brandingConsistent: true, ctaAppropriate: true },
  },
  {
    post_id: "POST-003",
    platform: "tiktok",
    project: "caliber",
    linked_stage: "content-creation",
    hook: "3 signs your body is begging for this peptide",
    angle: "Listicle \u2014 symptoms TB-500 addresses",
    cta_type: "engagement",
    owner: "Atlas",
    status: "drafted",
    reviewed: false,
    posted: false,
    post_url: "",
    performance: "",
    created_at: "2026-03-29T15:00:00Z",
    nextAction: "Send to Darwin for quality review",
    qualityScore: 0,
    tag: "test",
    review: { score: 0, notes: "", reviewedBy: "" },
    scriptPrompt: "Create a TikTok about TB-500 symptom recognition.\n\nHook: Pattern interrupt with '3 signs'\nDuration: 30 seconds\nTone: Conversational, authentic\nCTA: 'Comment RECOVERY for the full guide'",
    visualPrompt: "Talking head format with text overlay for each sign.\nSign 1: Persistent inflammation (show red overlay on body)\nSign 2: Slow wound healing (show timeline graphic)\nSign 3: Chronic fatigue post-workout (show tired gym footage)\n\nKeep it raw and authentic, not polished.",
    outputText: "",
    housekeeping: { ...DEFAULT_HOUSEKEEPING },
  },
  {
    post_id: "POST-004",
    platform: "tiktok",
    project: "caliber",
    linked_stage: "content-creation",
    hook: "Stop wasting money on peptides that don't work",
    angle: "Contrarian \u2014 quality vs cheap suppliers",
    cta_type: "hard",
    owner: "Ginge",
    status: "planned",
    reviewed: false,
    posted: false,
    post_url: "",
    performance: "",
    created_at: "2026-03-30T08:00:00Z",
    nextAction: "Write script and visual direction",
    qualityScore: 0,
    tag: "none",
    review: { score: 0, notes: "", reviewedBy: "" },
    scriptPrompt: "",
    visualPrompt: "",
    outputText: "",
    housekeeping: { ...DEFAULT_HOUSEKEEPING },
  },
];

const SEED_RULES: PlatformRule[] = [
  {
    platform_id: "instagram-reels",
    platform_name: "Instagram Reels",
    format_rules: "9:16 vertical (1080x1920). Max 90 seconds for reach, 15-30s optimal. First 3 seconds must hook. Use native IG music when possible for algorithm boost.",
    housekeeping_rules: "Reels need voice or TTS when required\nImages/videos should not be shaky\nText must fit properly within frame\nThumbnails should clearly show subject where relevant\nFraming should be correct for platform aspect ratio\nSubtitles should be readable (size, contrast, positioning)\nBranding should be consistent across posts\nCTA usage must vary \u2014 not every post should be hard CTA\nSome posts should build goodwill/value first before asking",
    voice_tts: "Voice or TTS required on all reels. Natural voice preferred. If using TTS, use a conversational tone \u2014 avoid robotic AI voices. Ensure audio levels are balanced with background music.",
    subtitle_rules: "Auto-captions ON for all reels. Font: bold sans-serif, white with dark outline. Size: readable on mobile (min 36pt equivalent). Position: center-bottom, above safe zone. No more than 2 lines visible at once.",
    thumbnail_rules: "Custom cover image for every reel. Must show subject clearly. Use brand font for any text overlay. Avoid cluttered covers \u2014 one focal point. Ensure face or product is visible at thumbnail size.",
    cta_rules: "Rotate CTA types: 40% value-only, 30% soft, 20% engagement, 10% hard. Never use hard CTA on consecutive posts. Approved CTAs: 'DM us [KEYWORD]', 'Link in bio', 'Save this for later', 'Follow for more'. No 'buy now' or aggressive sales language.",
    branding_rules: "Caliber Peptides watermark bottom-right on every slide. Brand colours: dark teal #0a1a1e background, white text, teal accent #00d4d4. Consistent font usage across all posts. Logo must be visible but not dominant.",
    bot_mistakes: "Forgetting to add voice/TTS to reels\nUsing hard CTA on every post\nInconsistent subtitle positioning\nNot checking aspect ratio before posting\nUsing stock music instead of trending audio\nIgnoring safe zones for text placement\nMaking thumbnails too busy\nNot varying content angles enough\nForgetting watermark on carousel slides",
  },
  {
    platform_id: "tiktok",
    platform_name: "TikTok",
    format_rules: "9:16 vertical (1080x1920). 15-60 seconds optimal. Hook in first 1-2 seconds. Use trending sounds when relevant. Native editing preferred for algorithm.",
    housekeeping_rules: "",
    voice_tts: "Voice required. TikTok TTS acceptable but custom voice preferred. Match energy to content type.",
    subtitle_rules: "Built-in captions or manual text overlay. Bold, high contrast. Keep within safe zones. Avoid bottom 15%.",
    thumbnail_rules: "First frame matters most. Use text hook overlay on cover. Clear, high contrast, mobile-readable.",
    cta_rules: "Softer CTAs perform better. 'Follow for part 2', 'Comment [WORD] for the guide', 'Link in bio'.",
    branding_rules: "Subtle branding only. Small watermark acceptable. Over-branding kills reach on TikTok.",
    bot_mistakes: "Over-branding content\nUsing Instagram-style CTAs\nIgnoring TikTok safe zones\nNot using trending sounds\nMaking content too polished",
  },
  {
    platform_id: "reddit",
    platform_name: "Reddit",
    format_rules: "Text posts preferred. Follow subreddit rules exactly. No direct self-promotion in most subs.",
    housekeeping_rules: "",
    voice_tts: "N/A for text posts. Video posts: voice narration preferred.",
    subtitle_rules: "N/A for text. Video posts: captions required for accessibility.",
    thumbnail_rules: "Reddit auto-generates. For link posts: ensure OG image is set.",
    cta_rules: "NO direct CTAs. 'Happy to share more if interested' is the maximum acceptable CTA.",
    branding_rules: "Zero branding. Authenticity is everything. Post as a helpful community member.",
    bot_mistakes: "Being too promotional\nIgnoring subreddit rules\nPosting links too early\nNot engaging with comments",
  },
  {
    platform_id: "x-twitter",
    platform_name: "X / Twitter",
    format_rules: "280 chars for text. Thread for long-form. Images: 16:9 or 1:1. First tweet must stand alone.",
    housekeeping_rules: "",
    voice_tts: "N/A for text. Video: voice or captions required.",
    subtitle_rules: "Burn-in captions for all video. White text, dark background strip.",
    thumbnail_rules: "Custom thumbnail for video. Link preview image should be compelling. Alt text on all images.",
    cta_rules: "Engage-first strategy. 'RT if you agree', 'Reply with yours', 'Bookmark this thread'.",
    branding_rules: "Consistent profile branding. No watermarks on shared content. Use brand hashtag sparingly.",
    bot_mistakes: "Using too many hashtags (max 2)\nPosting links in first tweet of thread\nNot using alt text\nBeing too formal",
  },
  {
    platform_id: "youtube-shorts",
    platform_name: "YouTube Shorts",
    format_rules: "9:16 vertical, under 60 seconds. Hook in first 2 seconds. Loop-friendly endings boost watch time.",
    housekeeping_rules: "",
    voice_tts: "Voice narration required. Clear audio, minimal background music.",
    subtitle_rules: "Hardcoded captions required. Large, bold, high contrast. Position center or center-bottom.",
    thumbnail_rules: "YouTube auto-selects frame. Ensure key frames are visually compelling.",
    cta_rules: "'Subscribe for more' is acceptable. 'Full video on channel' for shorts that tease long-form.",
    branding_rules: "Channel branding through consistent intro/outro style. Watermark optional.",
    bot_mistakes: "Forgetting #Shorts tag\nMaking shorts over 60 seconds\nNo voice narration\nPoor audio quality",
  },
];

const SEED_PROMPTS: PromptBlock[] = [
  {
    id: "prompt-ig-base", platform_id: "instagram-reels", type: "base-creation", version: "v1.2",
    prompt_text: "You are a world-class short-form content creator for Caliber Peptides. Create an Instagram Reel script about [TOPIC].\n\nRequirements:\n- Hook in first 1-2 seconds (curiosity gap or bold claim)\n- 15-30 second duration\n- Educational tone, not salesy\n- Include voice-over script with timing markers\n- Suggest trending audio if applicable\n- Visual direction for each scene (2-4 scenes)\n- Caption with 3-5 relevant hashtags including #CaliberPeptides\n- CTA must be from approved list: 'DM us [KEYWORD]', 'Link in bio', 'Save this', 'Follow for more'\n\nBrand guidelines: Dark teal aesthetic, scientific authority, accessible language. No medical claims.",
  },
  {
    id: "prompt-ig-housekeeping", platform_id: "instagram-reels", type: "housekeeping-checklist", version: "v1.0",
    prompt_text: "Review this Instagram Reel against the housekeeping checklist. Check EVERY item:\n\n[ ] Voice or TTS present and clear\n[ ] Video is not shaky or poorly stabilized\n[ ] Text fits within frame (no cutoff on any device)\n[ ] Thumbnail clearly shows subject\n[ ] Correct aspect ratio (9:16, 1080x1920)\n[ ] Subtitles readable \u2014 correct size, contrast, positioning\n[ ] Branding consistent \u2014 watermark, colours, fonts\n[ ] CTA is appropriate type (not every post should be hard CTA)\n[ ] Audio levels balanced (voice vs music)\n[ ] Safe zones respected (no text in bottom 10%)\n\nOutput: PASS/FAIL for each item, overall score, and specific fixes needed.",
  },
  {
    id: "prompt-ig-review", platform_id: "instagram-reels", type: "review", version: "v1.1",
    prompt_text: "You are Darwin, the quality control agent. Review this Instagram Reel content for Caliber Peptides.\n\nEvaluate on these criteria (rate each 1-10):\n1. Hook strength \u2014 does it stop the scroll in 1-2 seconds?\n2. Educational value \u2014 does the viewer learn something?\n3. Brand alignment \u2014 does it match Caliber's scientific authority tone?\n4. CTA appropriateness \u2014 is the CTA type right for this content?\n5. Technical quality \u2014 audio, video, text, branding all correct?\n6. Engagement potential \u2014 will people save/share/comment?\n\nINSTANT REJECT if: medical claims, wrong brand colours, no voice/TTS, aggressive sales language.\n\nOutput: Score per criterion, overall rating, APPROVED/NEEDS REVISION, specific revision notes.",
  },
  {
    id: "prompt-ig-improvement", platform_id: "instagram-reels", type: "improvement", version: "v1.0",
    prompt_text: "This Instagram Reel scored [SCORE]/10. Here is the review feedback: [FEEDBACK]\n\nRewrite/improve the content to address every issue raised. Specifically:\n- If hook was weak: write 3 alternative hooks and recommend the strongest\n- If CTA was wrong: replace with appropriate CTA from approved list\n- If brand alignment was off: adjust tone and visual direction\n- If technical issues: specify exact fixes needed\n\nOutput the improved version in the same format as the original, with a change log.",
  },
  {
    id: "prompt-tt-base", platform_id: "tiktok", type: "base-creation", version: "v1.0",
    prompt_text: "You are a viral TikTok content creator for Caliber Peptides. Create a TikTok script about [TOPIC].\n\nRequirements:\n- Hook in first 1 second (pattern interrupt, bold statement, or question)\n- 15-45 second duration\n- Conversational, authentic tone (not corporate)\n- Voice-over script with timing\n- Suggest trending sound if applicable\n- Visual direction: talking head, B-roll suggestions, text overlays\n- Caption with relevant hashtags\n- Soft CTA only: 'Follow for part 2', 'Comment [WORD] for guide'\n\nTikTok-specific: Be authentic, not polished. Educational content with personality wins. No hard sells.",
  },
  {
    id: "prompt-tt-housekeeping", platform_id: "tiktok", type: "housekeeping-checklist", version: "v1.0",
    prompt_text: "Review this TikTok content against the platform checklist:\n\n[ ] Hook lands in first 1-2 seconds\n[ ] Video feels authentic (not over-produced)\n[ ] Voice/TTS present and engaging\n[ ] Text overlays within safe zones (avoid bottom 15%)\n[ ] Captions/subtitles added\n[ ] Trending sound used where appropriate\n[ ] Branding is subtle (no heavy logos)\n[ ] CTA is soft and platform-appropriate\n[ ] Length is optimal (15-45 seconds)\n\nOutput: PASS/FAIL per item, overall assessment, fixes needed.",
  },
  {
    id: "prompt-tt-review", platform_id: "tiktok", type: "review", version: "v1.0",
    prompt_text: "Review this TikTok content. Rate 1-10 on: hook strength, authenticity, educational value, engagement potential, platform fit, CTA appropriateness. REJECT if: over-branded, aggressive CTA, medical claims. Output: scores, overall rating, APPROVED/NEEDS REVISION, notes.",
  },
  {
    id: "prompt-tt-improvement", platform_id: "tiktok", type: "improvement", version: "v1.0",
    prompt_text: "This TikTok scored [SCORE]/10. Feedback: [FEEDBACK]. Rewrite to fix all issues. Make it more authentic and less corporate. Write 3 alternative hooks. Ensure CTA is soft. Output improved version with change log.",
  },
];

const PROMPT_TYPE_LABEL: Record<string, string> = {
  "base-creation": "Base Creation Prompt",
  "housekeeping-checklist": "Housekeeping Checklist Prompt",
  review: "Review Prompt",
  improvement: "Improvement Prompt",
};

const PLATFORMS = ["instagram", "tiktok", "reddit", "x", "youtube"] as const;
const STATUSES = ["planned", "drafted", "reviewed", "scheduled", "posted", "analyzed"] as const;
const CTA_TYPES = ["hard", "soft", "value-only", "engagement"] as const;
const TAG_OPTIONS: PostTag[] = ["none", "winner", "test", "flop"];
const PROJECTS = [
  { id: "caliber", name: "Caliber Peptides" },
  { id: "gemsnap", name: "GemSnap" },
  { id: "edge-auto", name: "Edge Auto" },
];

/* ── Tabs ── */
const TABS = [
  { id: "post-log", label: "Post Log" },
  { id: "pipeline", label: "Content Pipeline" },
  { id: "rules", label: "Platform Rules" },
  { id: "prompts", label: "Prompt Blocks" },
];

/* ── Helpers ── */
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

async function apiSave(endpoint: string, body: unknown) {
  try {
    await fetch(`/api/map-room/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // Silently fail for placeholder saves
  }
}

/* ── Housekeeping Checklist Labels ── */
const HOUSEKEEPING_LABELS: { key: keyof HousekeepingChecklist; label: string }[] = [
  { key: "formatCorrect", label: "Format correct?" },
  { key: "subtitlesReadable", label: "Subtitles readable?" },
  { key: "ttsVoicePresent", label: "TTS/voice present?" },
  { key: "thumbnailClear", label: "Thumbnail clear?" },
  { key: "brandingConsistent", label: "Branding consistent?" },
  { key: "ctaAppropriate", label: "CTA type appropriate?" },
];

/* ── Copy to clipboard helper ── */
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ── Collapsible Prompt Block ── */
function CollapsiblePromptBlock({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!text) return null;

  return (
    <div className="rounded border" style={{ borderColor: C.border }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium"
        style={{ color: C.muted }}
        onClick={() => setOpen(!open)}
      >
        <span>{label}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3">
          <pre
            className="text-xs whitespace-pre-wrap leading-relaxed p-3 rounded font-mono"
            style={{ background: C.bg, color: C.body, border: `1px solid ${C.border}` }}
          >
            {text}
          </pre>
          <button
            className="mt-2 text-xs px-3 py-1 rounded transition-colors"
            style={{
              background: copied ? `${C.success}20` : `${C.accent}10`,
              color: copied ? C.success : C.accent,
            }}
            onClick={async () => {
              const ok = await copyToClipboard(text);
              if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB A: POST LOG
   ══════════════════════════════════════════════════════════ */
function PostLogTab({
  posts,
  setPosts,
}: {
  posts: Post[];
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>;
}) {
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterReviewed, setFilterReviewed] = useState<string>("all");
  const [filterPosted, setFilterPosted] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [remixConfirm, setRemixConfirm] = useState<string | null>(null);
  const [variationConfirm, setVariationConfirm] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...posts];
    if (filterPlatform !== "all") result = result.filter((p) => p.platform === filterPlatform);
    if (filterProject !== "all") result = result.filter((p) => p.project === filterProject);
    if (filterStatus !== "all") result = result.filter((p) => p.status === filterStatus);
    if (filterReviewed !== "all") result = result.filter((p) => (filterReviewed === "yes" ? p.reviewed : !p.reviewed));
    if (filterPosted !== "all") result = result.filter((p) => (filterPosted === "yes" ? p.posted : !p.posted));

    if (sortBy === "newest") result.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sortBy === "status") result.sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status));
    if (sortBy === "platform") result.sort((a, b) => a.platform.localeCompare(b.platform));

    return result;
  }, [posts, filterPlatform, filterProject, filterStatus, filterReviewed, filterPosted, sortBy]);

  const updatePost = useCallback(
    (postId: string, updates: Partial<Post>) => {
      setPosts((prev) =>
        prev.map((p) => (p.post_id === postId ? { ...p, ...updates } : p))
      );
    },
    [setPosts]
  );

  const handleRemix = (postId: string) => {
    setRemixConfirm(postId);
    setTimeout(() => setRemixConfirm(null), 3000);
  };

  const handleVariation = (postId: string) => {
    setVariationConfirm(postId);
    setTimeout(() => setVariationConfirm(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-3 p-4 rounded-lg border"
        style={{ background: C.card, borderColor: C.border }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
          Filters:
        </span>
        <select
          className="px-2 py-1.5 rounded text-xs"
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.heading }}
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        <select
          className="px-2 py-1.5 rounded text-xs"
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.heading }}
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="all">All Projects</option>
          {PROJECTS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          className="px-2 py-1.5 rounded text-xs"
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.heading }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <select
          className="px-2 py-1.5 rounded text-xs"
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.heading }}
          value={filterReviewed}
          onChange={(e) => setFilterReviewed(e.target.value)}
        >
          <option value="all">Reviewed: Any</option>
          <option value="yes">Reviewed</option>
          <option value="no">Not Reviewed</option>
        </select>
        <select
          className="px-2 py-1.5 rounded text-xs"
          style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.heading }}
          value={filterPosted}
          onChange={(e) => setFilterPosted(e.target.value)}
        >
          <option value="all">Posted: Any</option>
          <option value="yes">Posted</option>
          <option value="no">Not Posted</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: C.muted }}>Sort:</span>
          <select
            className="px-2 py-1.5 rounded text-xs"
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.heading }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="status">Status</option>
            <option value="platform">Platform</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: C.border }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: `${C.bg}80`, borderBottom: `1px solid ${C.border}` }}>
                {["", "ID", "Platform", "Project", "Hook", "CTA", "Owner", "Status", "Review", "Tag", "Quality", "Next Action", "Posted", "Performance"].map(
                  (h) => (
                    <th
                      key={h || "expand"}
                      className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wider whitespace-nowrap"
                      style={{ color: C.muted }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((post, idx) => {
                const ctaBadge = CTA_BADGE[post.cta_type];
                const tagCfg = TAG_CONFIG[post.tag];
                const isExpanded = expandedPost === post.post_id;
                return (
                  <>
                    <tr
                      key={post.post_id}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: isExpanded ? "none" : `1px solid ${C.border}`,
                        background: idx % 2 === 0 ? C.card : `${C.bg}60`,
                      }}
                      onClick={() => setExpandedPost(isExpanded ? null : post.post_id)}
                    >
                      {/* Expand Arrow */}
                      <td className="px-3 py-3 w-8">
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"
                          className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </td>

                      {/* ID */}
                      <td className="px-3 py-3">
                        <span className="text-xs font-mono" style={{ color: C.accent }}>
                          {post.post_id}
                        </span>
                      </td>

                      {/* Platform */}
                      <td className="px-3 py-3">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded"
                          style={{
                            background: `${PLATFORM_COLOR[post.platform]}15`,
                            color: PLATFORM_COLOR[post.platform],
                          }}
                        >
                          {PLATFORM_ICON[post.platform]} {post.platform}
                        </span>
                      </td>

                      {/* Project */}
                      <td className="px-3 py-3">
                        <span className="text-xs" style={{ color: C.body }}>
                          {PROJECTS.find((p) => p.id === post.project)?.name || post.project}
                        </span>
                      </td>

                      {/* Hook */}
                      <td className="px-3 py-3 max-w-[200px]">
                        <span className="text-xs line-clamp-2" style={{ color: C.heading }}>
                          {post.hook}
                        </span>
                      </td>

                      {/* CTA */}
                      <td className="px-3 py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{
                            background: `${ctaBadge.color}15`,
                            color: ctaBadge.color,
                          }}
                        >
                          {ctaBadge.label}
                        </span>
                      </td>

                      {/* Owner */}
                      <td className="px-3 py-3">
                        <span className="text-xs" style={{ color: C.body }}>
                          {post.owner}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded font-medium"
                          style={{
                            background: `${STATUS_COLOR[post.status]}15`,
                            color: STATUS_COLOR[post.status],
                          }}
                        >
                          {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                        </span>
                      </td>

                      {/* Review Status */}
                      <td className="px-3 py-3">
                        {post.reviewed ? (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-medium"
                            style={{ background: `${C.success}15`, color: C.success }}
                          >
                            {post.review.score}/10
                          </span>
                        ) : (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold animate-pulse"
                            style={{ background: `${C.warn}20`, color: C.warn }}
                          >
                            Needs Review
                          </span>
                        )}
                      </td>

                      {/* Tag */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          className="px-2 py-1 rounded text-xs font-medium"
                          style={{
                            background: `${tagCfg.color}15`,
                            border: `1px solid ${tagCfg.color}30`,
                            color: tagCfg.color,
                          }}
                          value={post.tag}
                          onChange={(e) => updatePost(post.post_id, { tag: e.target.value as PostTag })}
                        >
                          {TAG_OPTIONS.map((t) => (
                            <option key={t} value={t}>{TAG_CONFIG[t].label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Quality Score */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          className="w-12 px-1 py-0.5 rounded text-xs text-center font-mono"
                          style={{
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            color: post.qualityScore > 0 ? C.heading : C.muted,
                            outline: "none",
                          }}
                          value={post.qualityScore || ""}
                          placeholder="-"
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(10, parseInt(e.target.value) || 0));
                            updatePost(post.post_id, { qualityScore: val });
                          }}
                        />
                      </td>

                      {/* Next Action */}
                      <td className="px-3 py-3 max-w-[180px]">
                        <span className="text-xs line-clamp-2" style={{ color: C.body }}>
                          {post.nextAction || <span style={{ color: C.muted }}>--</span>}
                        </span>
                      </td>

                      {/* Posted Toggle */}
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="w-8 h-5 rounded-full relative transition-colors"
                          style={{
                            background: post.posted ? C.success : C.border,
                          }}
                          onClick={() => updatePost(post.post_id, { posted: !post.posted })}
                        >
                          <span
                            className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
                            style={{
                              background: C.heading,
                              left: post.posted ? "14px" : "2px",
                            }}
                          />
                        </button>
                      </td>

                      {/* Performance */}
                      <td className="px-3 py-3">
                        {post.performance ? (
                          <span className="text-xs" style={{ color: C.success }}>
                            {post.performance}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: C.muted }}>
                            Awaiting data
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded Row */}
                    {isExpanded && (
                      <tr key={`${post.post_id}-expanded`}>
                        <td
                          colSpan={14}
                          className="px-0 py-0"
                          style={{
                            borderBottom: `1px solid ${C.border}`,
                            background: `${C.bg}90`,
                          }}
                        >
                          <div className="p-5 space-y-5">
                            {/* Top row: Review section + Actions */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                              {/* Review Section */}
                              <div
                                className="rounded-lg border p-4 space-y-3"
                                style={{ background: C.card, borderColor: C.border }}
                              >
                                <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: C.heading }}>
                                  Review
                                  {!post.reviewed && (
                                    <span
                                      className="text-xs px-2 py-0.5 rounded font-bold animate-pulse"
                                      style={{ background: `${C.warn}20`, color: C.warn }}
                                    >
                                      Needs Review
                                    </span>
                                  )}
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <label className="text-xs block mb-1" style={{ color: C.muted }}>Score (1-10)</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={10}
                                      className="w-full px-2 py-1.5 rounded text-sm font-mono"
                                      style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.heading, outline: "none" }}
                                      value={post.review.score || ""}
                                      onChange={(e) => {
                                        const val = Math.max(0, Math.min(10, parseInt(e.target.value) || 0));
                                        updatePost(post.post_id, {
                                          review: { ...post.review, score: val },
                                          reviewed: val > 0,
                                        });
                                      }}
                                    />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="text-xs block mb-1" style={{ color: C.muted }}>Reviewed By</label>
                                    <input
                                      className="w-full px-2 py-1.5 rounded text-sm"
                                      style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.heading, outline: "none" }}
                                      value={post.review.reviewedBy}
                                      placeholder="Owner name..."
                                      onChange={(e) =>
                                        updatePost(post.post_id, { review: { ...post.review, reviewedBy: e.target.value } })
                                      }
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-xs block mb-1" style={{ color: C.muted }}>Notes</label>
                                  <textarea
                                    className="w-full px-2 py-1.5 rounded text-sm"
                                    style={{
                                      background: C.bg,
                                      border: `1px solid ${C.border}`,
                                      color: C.heading,
                                      outline: "none",
                                      minHeight: "60px",
                                      resize: "vertical",
                                    }}
                                    value={post.review.notes}
                                    placeholder="Review notes..."
                                    onChange={(e) =>
                                      updatePost(post.post_id, { review: { ...post.review, notes: e.target.value } })
                                    }
                                  />
                                </div>
                              </div>

                              {/* Housekeeping Checklist */}
                              <div
                                className="rounded-lg border p-4 space-y-3"
                                style={{ background: C.card, borderColor: C.border }}
                              >
                                <h4 className="text-sm font-bold" style={{ color: C.heading }}>
                                  Housekeeping Checklist
                                </h4>
                                <div className="space-y-2">
                                  {HOUSEKEEPING_LABELS.map(({ key, label }) => {
                                    const checked = post.housekeeping[key];
                                    return (
                                      <label
                                        key={key}
                                        className="flex items-center gap-3 cursor-pointer group"
                                      >
                                        <button
                                          className="w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0"
                                          style={{
                                            borderColor: checked ? C.success : C.border,
                                            background: checked ? `${C.success}20` : "transparent",
                                          }}
                                          onClick={() =>
                                            updatePost(post.post_id, {
                                              housekeeping: { ...post.housekeeping, [key]: !checked },
                                            })
                                          }
                                        >
                                          {checked ? (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="3">
                                              <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                          ) : (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.error} strokeWidth="3">
                                              <path d="M18 6L6 18M6 6l12 12" />
                                            </svg>
                                          )}
                                        </button>
                                        <span
                                          className="text-sm"
                                          style={{ color: checked ? C.success : C.body }}
                                        >
                                          {label}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                                {/* Checklist score */}
                                <div className="pt-2 border-t" style={{ borderColor: C.border }}>
                                  <span className="text-xs" style={{ color: C.muted }}>
                                    Passed: {Object.values(post.housekeeping).filter(Boolean).length}/{HOUSEKEEPING_LABELS.length}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Prompts & Output */}
                            <div className="space-y-2">
                              <CollapsiblePromptBlock label="Script Prompt" text={post.scriptPrompt} />
                              <CollapsiblePromptBlock label="Visual Prompt" text={post.visualPrompt} />
                              {post.outputText && (
                                <CollapsiblePromptBlock label="Output Text" text={post.outputText} />
                              )}
                            </div>

                            {/* Performance Metrics Placeholder */}
                            {post.performance && (
                              <div
                                className="rounded-lg border p-4"
                                style={{ background: C.card, borderColor: C.border }}
                              >
                                <h4 className="text-sm font-bold mb-2" style={{ color: C.heading }}>
                                  Performance Metrics
                                </h4>
                                <p className="text-sm" style={{ color: C.success }}>
                                  {post.performance}
                                </p>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                              <button
                                className="text-xs font-bold px-4 py-2 rounded transition-all"
                                style={{
                                  background: remixConfirm === post.post_id ? `${C.success}20` : `${C.accent}15`,
                                  color: remixConfirm === post.post_id ? C.success : C.accent,
                                  border: `1px solid ${remixConfirm === post.post_id ? C.success : C.accent}40`,
                                }}
                                onClick={(e) => { e.stopPropagation(); handleRemix(post.post_id); }}
                              >
                                {remixConfirm === post.post_id ? "Remix queued!" : "Remix"}
                              </button>
                              <button
                                className="text-xs font-bold px-4 py-2 rounded transition-all"
                                style={{
                                  background: variationConfirm === post.post_id ? `${C.success}20` : `${C.warn}15`,
                                  color: variationConfirm === post.post_id ? C.success : C.warn,
                                  border: `1px solid ${variationConfirm === post.post_id ? C.success : C.warn}40`,
                                }}
                                onClick={(e) => { e.stopPropagation(); handleVariation(post.post_id); }}
                              >
                                {variationConfirm === post.post_id ? "Variation created!" : "Create Variation"}
                              </button>
                              {post.post_url && (
                                <a
                                  href={post.post_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-4 py-2 rounded"
                                  style={{ background: `${C.accent}10`, color: C.accent }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View Post
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs" style={{ color: C.muted }}>
        <span>Click row to expand</span>
        <span>|</span>
        {Object.entries(TAG_CONFIG).filter(([k]) => k !== "none").map(([, cfg]) => (
          <span key={cfg.label} style={{ color: cfg.color }}>{cfg.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB B: CONTENT PIPELINE (KANBAN)
   ══════════════════════════════════════════════════════════ */
function PipelineTab({ posts }: { posts: Post[] }) {
  const columns = STATUSES;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "400px" }}>
      {columns.map((status) => {
        const colPosts = posts.filter((p) => p.status === status);
        return (
          <div
            key={status}
            className="flex-shrink-0 rounded-lg border"
            style={{
              background: C.card,
              borderColor: C.border,
              width: "240px",
              minWidth: "240px",
            }}
          >
            {/* Column Header */}
            <div
              className="flex items-center justify-between px-3 py-3 border-b"
              style={{ borderColor: C.border }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: STATUS_COLOR[status] }}
                />
                <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: C.heading }}>
                  {status}
                </span>
              </div>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: `${STATUS_COLOR[status]}15`, color: STATUS_COLOR[status] }}
              >
                {colPosts.length}
              </span>
            </div>

            {/* Cards */}
            <div className="p-2 space-y-2">
              {colPosts.length === 0 && (
                <div
                  className="text-center py-6 text-xs rounded border border-dashed"
                  style={{ color: C.muted, borderColor: C.border }}
                >
                  No posts
                </div>
              )}
              {colPosts.map((post) => {
                const tagCfg = TAG_CONFIG[post.tag];
                return (
                  <div
                    key={post.post_id}
                    className="rounded-md border p-3 space-y-2 transition-colors"
                    style={{
                      background: C.bg,
                      borderColor: C.border,
                      borderLeft: `3px solid ${PLATFORM_COLOR[post.platform]}`,
                    }}
                  >
                    {/* Platform + ID */}
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{
                          background: `${PLATFORM_COLOR[post.platform]}15`,
                          color: PLATFORM_COLOR[post.platform],
                        }}
                      >
                        {PLATFORM_ICON[post.platform]} {post.platform}
                      </span>
                      <span className="text-xs font-mono" style={{ color: C.muted }}>
                        {post.post_id}
                      </span>
                    </div>

                    {/* Hook */}
                    <p className="text-xs leading-snug line-clamp-2" style={{ color: C.heading }}>
                      {post.hook}
                    </p>

                    {/* Project + Owner */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: C.accent }}>
                        {PROJECTS.find((p) => p.id === post.project)?.name || post.project}
                      </span>
                      <span className="text-xs" style={{ color: C.muted }}>
                        {post.owner}
                      </span>
                    </div>

                    {/* CTA Badge + Tag */}
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block text-xs px-2 py-0.5 rounded font-medium"
                        style={{
                          background: `${CTA_BADGE[post.cta_type].color}15`,
                          color: CTA_BADGE[post.cta_type].color,
                        }}
                      >
                        {CTA_BADGE[post.cta_type].label}
                      </span>
                      {post.tag !== "none" && (
                        <span
                          className="inline-block text-xs px-2 py-0.5 rounded font-medium"
                          style={{
                            background: `${tagCfg.color}15`,
                            color: tagCfg.color,
                          }}
                        >
                          {tagCfg.label}
                        </span>
                      )}
                    </div>

                    {/* Review status */}
                    {!post.reviewed && (
                      <span
                        className="inline-block text-xs px-2 py-0.5 rounded font-bold"
                        style={{ background: `${C.warn}20`, color: C.warn }}
                      >
                        Needs Review
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB C: PLATFORM RULES
   ══════════════════════════════════════════════════════════ */
function PlatformRulesTab({
  rules,
  setRules,
}: {
  rules: PlatformRule[];
  setRules: React.Dispatch<React.SetStateAction<PlatformRule[]>>;
}) {
  const RULE_FIELDS: { key: keyof PlatformRule; label: string }[] = [
    { key: "format_rules", label: "Format Rules" },
    { key: "housekeeping_rules", label: "Housekeeping Rules" },
    { key: "voice_tts", label: "Voice / TTS Requirement" },
    { key: "subtitle_rules", label: "Subtitle / Text Fit Rules" },
    { key: "thumbnail_rules", label: "Thumbnail Rules" },
    { key: "cta_rules", label: "CTA Rules" },
    { key: "branding_rules", label: "Branding Rules" },
    { key: "bot_mistakes", label: "Things Bots Usually Miss" },
  ];

  const [editingField, setEditingField] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const startEdit = (platformId: string, fieldKey: string, value: string) => {
    setEditingField(`${platformId}:${fieldKey}`);
    setDraft(value);
  };

  const saveEdit = (platformId: string, fieldKey: string) => {
    setRules((prev) =>
      prev.map((r) => (r.platform_id === platformId ? { ...r, [fieldKey]: draft } : r))
    );
    setEditingField(null);
    apiSave("platform-rules", { rules, lastUpdated: new Date().toISOString() });
  };

  return (
    <div className="space-y-6">
      {rules.map((rule) => (
        <div
          key={rule.platform_id}
          className="rounded-lg border overflow-hidden"
          style={{ background: C.card, borderColor: C.border }}
        >
          {/* Platform Header */}
          <div
            className="flex items-center gap-3 px-5 py-4 border-b"
            style={{ borderColor: C.border, background: `${C.bg}80` }}
          >
            <span className="text-xl">{PLATFORM_ICON[rule.platform_id.split("-")[0]] || "\uD83D\uDCF1"}</span>
            <h3 className="text-lg font-bold" style={{ color: C.heading }}>
              {rule.platform_name}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${C.accent}10`, color: C.accent }}>
              Editable
            </span>
          </div>

          {/* Rule Sections */}
          <div className="divide-y" style={{ borderColor: C.border }}>
            {RULE_FIELDS.map(({ key, label }) => {
              const value = rule[key] as string;
              const isEditing = editingField === `${rule.platform_id}:${key}`;
              const isEmpty = !value || value.trim() === "";
              const isHousekeeping = key === "housekeeping_rules";

              return (
                <div key={key} className="px-5 py-4" style={{ borderColor: C.border }}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold" style={{ color: C.heading }}>
                      {label}
                    </h4>
                    {!isEditing && (
                      <button
                        className="text-xs px-2 py-1 rounded transition-colors"
                        style={{ color: C.accent, background: `${C.accent}10` }}
                        onClick={() => startEdit(rule.platform_id, key, value)}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        className="w-full px-3 py-2 rounded text-sm"
                        style={{
                          background: C.bg,
                          border: `1px solid ${C.accent}`,
                          color: C.heading,
                          outline: "none",
                          minHeight: "120px",
                          resize: "vertical",
                        }}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1.5 rounded text-xs font-medium"
                          style={{ background: C.accent, color: "#000" }}
                          onClick={() => saveEdit(rule.platform_id, key)}
                        >
                          Save
                        </button>
                        <button
                          className="px-3 py-1.5 rounded text-xs font-medium"
                          style={{ background: C.border, color: C.body }}
                          onClick={() => setEditingField(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : isEmpty ? (
                    <p className="text-sm italic" style={{ color: C.muted }}>
                      No rules defined yet. Click Edit to add.
                    </p>
                  ) : isHousekeeping || key === "bot_mistakes" ? (
                    <ul className="space-y-1.5">
                      {value.split("\n").filter(Boolean).map((line, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm" style={{ color: C.body }}>
                          <span
                            className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{
                              background: key === "bot_mistakes" ? C.error : C.accent,
                            }}
                          />
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm leading-relaxed" style={{ color: C.body }}>
                      {value}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   TAB D: PROMPT BLOCKS
   ══════════════════════════════════════════════════════════ */
function PromptBlocksTab({
  prompts,
  setPrompts,
}: {
  prompts: PromptBlock[];
  setPrompts: React.Dispatch<React.SetStateAction<PromptBlock[]>>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const platformPrompts = useMemo(() => {
    const grouped: Record<string, PromptBlock[]> = {};
    for (const p of prompts) {
      if (!grouped[p.platform_id]) grouped[p.platform_id] = [];
      grouped[p.platform_id].push(p);
    }
    return grouped;
  }, [prompts]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyPrompt = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API may fail
    }
  };

  const startEdit = (prompt: PromptBlock) => {
    setEditingId(prompt.id);
    setDraft(prompt.prompt_text);
    setExpanded((prev) => new Set(prev).add(prompt.id));
  };

  const saveEdit = (id: string) => {
    setPrompts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, prompt_text: draft } : p))
    );
    setEditingId(null);
    apiSave("prompts", { prompts, lastUpdated: new Date().toISOString() });
  };

  const PLATFORM_ORDER = ["instagram-reels", "tiktok", "reddit", "x-twitter", "youtube-shorts"];

  return (
    <div className="space-y-6">
      {PLATFORM_ORDER.map((platformId) => {
        const pPrompts = platformPrompts[platformId];
        if (!pPrompts || pPrompts.length === 0) return null;

        const platformKey = platformId.split("-")[0];
        const platformName =
          SEED_RULES.find((r) => r.platform_id === platformId)?.platform_name || platformId;

        return (
          <div
            key={platformId}
            className="rounded-lg border overflow-hidden"
            style={{ background: C.card, borderColor: C.border }}
          >
            {/* Platform Header */}
            <div
              className="flex items-center gap-3 px-5 py-4 border-b"
              style={{ borderColor: C.border, background: `${C.bg}80` }}
            >
              <span className="text-xl">{PLATFORM_ICON[platformKey] || "\uD83D\uDCF1"}</span>
              <h3 className="text-lg font-bold" style={{ color: C.heading }}>
                {platformName}
              </h3>
              <span className="text-xs" style={{ color: C.muted }}>
                {pPrompts.length} prompts
              </span>
            </div>

            {/* Prompt Dropdowns */}
            <div className="divide-y" style={{ borderColor: C.border }}>
              {pPrompts.map((prompt) => {
                const isOpen = expanded.has(prompt.id);
                const isEditing = editingId === prompt.id;
                const isCopied = copied === prompt.id;

                return (
                  <div key={prompt.id} style={{ borderColor: C.border }}>
                    {/* Collapsible Header */}
                    <button
                      className="w-full flex items-center justify-between px-5 py-3 transition-colors"
                      style={{ background: isOpen ? `${C.accent}05` : "transparent" }}
                      onClick={() => toggleExpand(prompt.id)}
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={C.muted}
                          strokeWidth="2"
                          className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <span className="text-sm font-medium" style={{ color: C.heading }}>
                          {PROMPT_TYPE_LABEL[prompt.type] || prompt.type}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: `${C.accent}10`, color: C.accent }}
                        >
                          {prompt.version}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs px-2 py-1 rounded"
                          style={{ color: C.accent, background: `${C.accent}10` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyPrompt(prompt.id, prompt.prompt_text);
                          }}
                        >
                          {isCopied ? "Copied" : "Copy"}
                        </button>
                        <button
                          className="text-xs px-2 py-1 rounded"
                          style={{ color: C.warn, background: `${C.warn}10` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(prompt);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {isOpen && (
                      <div className="px-5 pb-4">
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full px-3 py-2 rounded text-sm font-mono"
                              style={{
                                background: C.bg,
                                border: `1px solid ${C.accent}`,
                                color: C.heading,
                                outline: "none",
                                minHeight: "200px",
                                resize: "vertical",
                                lineHeight: "1.6",
                              }}
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                className="px-3 py-1.5 rounded text-xs font-medium"
                                style={{ background: C.accent, color: "#000" }}
                                onClick={() => saveEdit(prompt.id)}
                              >
                                Save
                              </button>
                              <button
                                className="px-3 py-1.5 rounded text-xs font-medium"
                                style={{ background: C.border, color: C.body }}
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <pre
                            className="text-sm whitespace-pre-wrap leading-relaxed p-4 rounded"
                            style={{
                              background: C.bg,
                              color: C.body,
                              border: `1px solid ${C.border}`,
                            }}
                          >
                            {prompt.prompt_text}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */
export default function SocialPage() {
  const [activeTab, setActiveTab] = useState("post-log");
  const [posts, setPosts] = useState<Post[]>(SEED_POSTS);
  const [rules, setRules] = useState<PlatformRule[]>(SEED_RULES);
  const [prompts, setPrompts] = useState<PromptBlock[]>(SEED_PROMPTS);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: C.heading }}>
          Social Command
        </h2>
        <p className="text-sm mt-1" style={{ color: C.body }}>
          Central content operations. Post log, pipeline, platform rules, and prompt blocks.
        </p>
      </div>

      {/* Internal Tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-lg border"
        style={{ background: C.card, borderColor: C.border }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                background: active ? `${C.accent}15` : "transparent",
                color: active ? C.accent : C.muted,
                borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
              }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}

        {/* Post count badges */}
        <div className="ml-auto flex items-center gap-3 pr-3 text-xs" style={{ color: C.muted }}>
          <span>
            <strong style={{ color: C.heading }}>{posts.length}</strong> posts
          </span>
          <span>
            <strong style={{ color: C.success }}>
              {posts.filter((p) => p.posted).length}
            </strong>{" "}
            posted
          </span>
          <span>
            <strong style={{ color: C.warn }}>
              {posts.filter((p) => !p.reviewed).length}
            </strong>{" "}
            unreviewed
          </span>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "post-log" && <PostLogTab posts={posts} setPosts={setPosts} />}
      {activeTab === "pipeline" && <PipelineTab posts={posts} />}
      {activeTab === "rules" && <PlatformRulesTab rules={rules} setRules={setRules} />}
      {activeTab === "prompts" && <PromptBlocksTab prompts={prompts} setPrompts={setPrompts} />}
    </div>
  );
}

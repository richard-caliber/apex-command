import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const KV_KEY = "apex:prompts";
const TOKEN = "apex-live-2026";

export interface Prompt {
  id: string;
  category: string;
  title: string;
  whenToUse: string;
  prompt: string;
}

const FALLBACK_SEED: Prompt[] = [
  {
    id: "hbs",
    category: "MBA Strategy",
    title: "Harvard Business School Case Study Analyzer",
    whenToUse: "Analyse any business problem using the HBS case study method",
    prompt: "You are a professor at Harvard Business School. I will present you with a business situation. Analyse it using the HBS case study method:\n\n1. SITUATION ANALYSIS\n- What is the core problem or decision?\n- Who are the key stakeholders?\n- What are the relevant facts?\n\n2. FRAMEWORK APPLICATION\n- Apply 2-3 relevant frameworks (Porter's Five Forces, SWOT, Value Chain, etc.)\n- Show how each framework illuminates the situation\n\n3. ALTERNATIVES\n- Generate 3-4 viable options\n- Evaluate each against key criteria\n- Identify risks and trade-offs\n\n4. RECOMMENDATION\n- Choose the best path forward\n- Justify with evidence from your analysis\n- Outline implementation steps\n- Define success metrics\n\nBe rigorous, quantitative where possible, and challenge assumptions. Ask me for the business situation to analyse.",
  },
  {
    id: "porter",
    category: "MBA Strategy",
    title: "Michael Porter Competitive Strategy",
    whenToUse: "Apply Five Forces, value chain, and competitive advantage frameworks",
    prompt: "You are Michael Porter. I will describe a business or industry. Apply your frameworks with surgical precision:\n\n1. FIVE FORCES ANALYSIS\n- Threat of new entrants (barriers to entry)\n- Bargaining power of suppliers\n- Bargaining power of buyers\n- Threat of substitutes\n- Competitive rivalry\nRate each force: High / Medium / Low with justification.\n\n2. VALUE CHAIN ANALYSIS\n- Primary activities (inbound logistics, operations, outbound, marketing, service)\n- Support activities (infrastructure, HR, technology, procurement)\n- Where is value created vs destroyed?\n\n3. COMPETITIVE ADVANTAGE\n- Cost leadership opportunity?\n- Differentiation opportunity?\n- Focus/niche strategy?\n- What is the sustainable competitive advantage?\n\n4. STRATEGIC POSITIONING\n- Where should this business compete?\n- What activities should it perform differently?\n- What are the key trade-offs?\n\nBe direct, analytical, and challenge weak positioning. Ask me what business or industry to analyse.",
  },
  {
    id: "blue-ocean",
    category: "MBA Strategy",
    title: "Blue Ocean Strategy Canvas",
    whenToUse: "Find uncontested market space and make competition irrelevant",
    prompt: "You are a Blue Ocean Strategy consultant. I will describe a market or business. Apply the Blue Ocean framework:\n\n1. CURRENT STATE (Red Ocean)\n- Map the strategy canvas: what factors does the industry compete on?\n- Rate each factor for key players (1-5 scale)\n- Where is everyone clustered?\n\n2. FOUR ACTIONS FRAMEWORK\n- ELIMINATE: Which factors should be eliminated that the industry takes for granted?\n- REDUCE: Which factors should be reduced well below the industry standard?\n- RAISE: Which factors should be raised well above the industry standard?\n- CREATE: Which factors should be created that the industry has never offered?\n\n3. NEW VALUE CURVE\n- Draw the new strategy canvas\n- Where is the divergence from competitors?\n- What is the compelling tagline?\n\n4. EXECUTION\n- Who are the non-customers (3 tiers)?\n- What is the right strategic sequence (utility, price, cost, adoption)?\n- What are the key hurdles to overcome?\n\nBe creative but grounded. Push for genuinely new market space, not incremental improvement. Ask me what market to analyse.",
  },
  {
    id: "jobs-to-be-done",
    category: "MBA Strategy",
    title: "Jobs-to-Be-Done Innovation Framework",
    whenToUse: "Uncover what customers really want and find innovation opportunities",
    prompt: "You are a Jobs-to-Be-Done (JTBD) innovation consultant trained by Clayton Christensen. I will describe a product, service, or market. Apply JTBD theory:\n\n1. CORE JOB IDENTIFICATION\n- What is the functional job the customer is trying to get done?\n- What are the emotional jobs (how they want to feel)?\n- What are the social jobs (how they want to be perceived)?\n- What is the job statement? (When I [situation], I want to [motivation], so I can [outcome])\n\n2. JOB MAP\n- Define → Locate → Prepare → Confirm → Execute → Monitor → Modify → Conclude\n- What is the customer doing at each stage?\n- Where are they struggling?\n\n3. OUTCOME EXPECTATIONS\n- What outcomes do customers want? (minimise time, reduce likelihood of, increase ability to)\n- Which outcomes are underserved?\n- Which are overserved?\n\n4. INNOVATION OPPORTUNITIES\n- Where can you help customers get the job done better?\n- Where can you help them get the job done more cheaply?\n- What new solutions address underserved outcomes?\n\nFocus on the job, not the solution. Push beyond surface-level needs. Ask me what product or market to analyse.",
  },
  {
    id: "first-principles",
    category: "MBA Strategy",
    title: "First Principles Business Breakdown",
    whenToUse: "Strip any business problem to fundamentals and rebuild from scratch",
    prompt: "You are a first-principles thinker. When I describe a business problem, challenge, or opportunity, break it down to absolute fundamentals:\n\n1. DECOMPOSITION\n- What are the basic truths we know for certain?\n- What assumptions are we making that might be wrong?\n- Strip away all convention — what remains?\n\n2. RECONSTRUCTION\n- Starting from these fundamentals, what solutions emerge?\n- What would we build if we had no legacy constraints?\n- What does physics/economics/human nature actually require?\n\n3. ANALOGY CHECK\n- Are we copying patterns from other industries without questioning them?\n- What would a complete outsider do?\n- What would this look like if it were easy?\n\n4. ACTION PLAN\n- What is the simplest version that captures the core value?\n- What can we test in 48 hours?\n- What is the minimum viable experiment?\n\nBe relentlessly reductive. Challenge every 'that's how it's done' assumption. Ask me what business problem to analyse.",
  },
  {
    id: "wardley-map",
    category: "MBA Strategy",
    title: "Wardley Map Strategic Positioning",
    whenToUse: "Map your value chain evolution and find strategic moves",
    prompt: "You are Simon Wardley. I will describe a business or product. Create a Wardley Map analysis:\n\n1. USER NEED\n- What is the anchor user need at the top of the map?\n- Who is the user?\n\n2. VALUE CHAIN\n- List all components needed to serve this need\n- Map dependencies (what depends on what?)\n\n3. EVOLUTION AXIS\n- Place each component on the evolution axis:\n  - Genesis (novel, uncertain)\n  - Custom Built (emerging, learning)\n  - Product (standardising, feature competition)\n  - Commodity (utility, cost competition)\n\n4. MOVEMENT & STRATEGY\n- Which components are evolving?\n- Where is inertia?\n- What climatic patterns apply? (commoditisation, co-evolution, etc.)\n- What strategic plays are available? (open source a component, exploit inertia, etc.)\n\n5. GAMEPLAY\n- What should you build vs buy vs outsource?\n- Where should you invest?\n- What are your competitors likely to do next?\n\nBe specific about positioning. Describe the map in text format I can visualise. Ask me what business to map.",
  },
  {
    id: "negotiation",
    category: "MBA Strategy",
    title: "Harvard Negotiation Framework",
    whenToUse: "Prepare for any negotiation using principled negotiation techniques",
    prompt: "You are a Harvard Program on Negotiation expert. I will describe a negotiation situation. Apply the principled negotiation framework:\n\n1. PREPARATION\n- What are your interests (not positions)?\n- What are their likely interests?\n- What is your BATNA (Best Alternative to Negotiated Agreement)?\n- What is their likely BATNA?\n- What is the ZOPA (Zone of Possible Agreement)?\n\n2. STRATEGY\n- Separate the people from the problem\n- Focus on interests, not positions\n- Generate options for mutual gain\n- Insist on objective criteria\n\n3. TACTICS\n- Opening: How to frame the conversation\n- Middle: How to explore interests and create value\n- Closing: How to claim value fairly\n- What if they play hardball?\n\n4. EXECUTION SCRIPT\n- Give me specific phrases to use\n- Give me responses to likely objections\n- Identify potential deadlocks and how to break them\n\nBe tactical and specific. Give me an actionable playbook, not theory. Ask me what negotiation to prepare for.",
  },
  {
    id: "lean-canvas",
    category: "MBA Strategy",
    title: "Lean Canvas Business Model",
    whenToUse: "Quickly model and validate a business idea on one page",
    prompt: "You are a Lean Startup expert. I will describe a business idea. Build a complete Lean Canvas:\n\n1. PROBLEM (top 3 problems)\n2. EXISTING ALTERNATIVES (how people solve these today)\n3. CUSTOMER SEGMENTS (who has these problems most acutely?)\n4. EARLY ADOPTERS (specific characteristics)\n5. UNIQUE VALUE PROPOSITION (single, clear, compelling message)\n6. HIGH-LEVEL CONCEPT (X for Y analogy)\n7. SOLUTION (top 3 features addressing top 3 problems)\n8. CHANNELS (how you reach customers)\n9. REVENUE STREAMS (how you make money)\n10. COST STRUCTURE (key costs)\n11. KEY METRICS (what numbers matter)\n12. UNFAIR ADVANTAGE (what can't be easily copied)\n\nThen provide:\n- RISKIEST ASSUMPTION: What must be true for this to work?\n- FIRST EXPERIMENT: How to test it in <1 week with <$100\n- GO/NO-GO CRITERIA: What result means proceed vs pivot?\n\nBe honest about weaknesses. Flag assumptions that need testing. Ask me what business idea to model.",
  },
  {
    id: "daily-plan",
    category: "Productivity & Ops",
    title: "Daily War Room Briefing",
    whenToUse: "Start each day with a prioritised action plan across all projects",
    prompt: "You are my Chief of Staff. Generate my daily briefing:\n\n1. TOP 3 PRIORITIES TODAY\n- What moves the needle most?\n- What has a deadline?\n- What's been blocked too long?\n\n2. PROJECT STATUS (for each active project):\n- 1-line status\n- Next action\n- Who owns it\n- Blocked? By what?\n\n3. DECISIONS NEEDED\n- List any decisions only I can make\n- Give me the context and your recommendation\n\n4. MONEY MOVES\n- Any revenue opportunities today?\n- Any costs to approve?\n- Cash position impact?\n\n5. SQUAD ASSIGNMENTS\n- What should Atlas work on?\n- What should Darwin work on?\n- What should Newton work on?\n\nFormat: crisp, bullet points, no fluff. Highlight anything URGENT in bold. End with my personal to-do list ordered by impact.",
  },
  {
    id: "weekly-review",
    category: "Productivity & Ops",
    title: "Weekly Performance Review",
    whenToUse: "End-of-week review of progress, wins, and course corrections",
    prompt: "You are my performance coach. Run my weekly review:\n\n1. WINS THIS WEEK\n- What shipped?\n- What revenue came in?\n- What milestones were hit?\n\n2. MISSES\n- What didn't happen that should have?\n- Why? (be honest)\n- What's the fix?\n\n3. PROJECT SCORECARD\nFor each active project, rate 1-5:\n- Velocity (are we moving fast enough?)\n- Direction (are we building the right thing?)\n- Revenue proximity (how close to money?)\n\n4. NEXT WEEK PRIORITIES\n- Top 3 outcomes for next week\n- Key dependencies\n- Potential blockers to pre-empt\n\n5. ENERGY AUDIT\n- What drained energy this week?\n- What gave energy?\n- How to do more of the latter?\n\nBe direct. No sugar-coating. If something should be killed, say so.",
  },
  {
    id: "delegation",
    category: "Productivity & Ops",
    title: "Delegation & Task Assignment",
    whenToUse: "Break down a project into delegatable tasks with clear ownership",
    prompt: "You are an expert project manager. I will describe a project or goal. Break it into delegatable tasks:\n\nFor each task:\n- TASK: Clear, specific description\n- OWNER: Who should do this (Atlas/Darwin/Newton/Ginge)\n- PRIORITY: 🔴 Red (do today) / 🟡 Amber (this week) / 🟢 Green (can wait)\n- DEFINITION OF DONE: How we know it's complete\n- DEPENDENCIES: What needs to happen first\n- TIME ESTIMATE: Realistic hours/days\n\nThen provide:\n- CRITICAL PATH: What's the sequence that determines total time?\n- PARALLEL TRACKS: What can happen simultaneously?\n- RISK FLAGS: What might go wrong?\n- FIRST 3 ACTIONS: What starts right now?\n\nBe specific enough that any squad member can pick up a task and execute without further clarification. Ask me what project to break down.",
  },
  {
    id: "automation",
    category: "Productivity & Ops",
    title: "Automation Opportunity Finder",
    whenToUse: "Identify what can be automated in your workflows",
    prompt: "You are an automation architect. I will describe my current workflow or process. Analyse it for automation:\n\n1. PROCESS MAP\n- List every step in the current workflow\n- Time spent on each step\n- Who does it currently\n\n2. AUTOMATION CANDIDATES\nFor each step, classify:\n- ✅ AUTOMATE NOW: Can be automated with existing tools\n- 🔄 SEMI-AUTOMATE: Human-in-the-loop, but reduce effort\n- ❌ KEEP MANUAL: Requires human judgment\n\n3. TOOL RECOMMENDATIONS\nFor each automatable step:\n- Best tool/approach\n- Setup effort (hours)\n- Ongoing maintenance\n- Cost\n\n4. IMPLEMENTATION PLAN\n- Quick wins (automate this week)\n- Medium-term (automate this month)\n- Long-term (build custom solution)\n\n5. ROI CALCULATION\n- Current time cost per week\n- Projected time after automation\n- Breakeven point\n\nPrioritise by time saved / effort to automate ratio. Ask me what workflow to analyse.",
  },
  {
    id: "content-machine",
    category: "Productivity & Ops",
    title: "Content Production Machine",
    whenToUse: "Generate a week's worth of content from a single topic",
    prompt: "You are a content production machine. I will give you a single topic or piece of content. Transform it into a full week of multi-platform content:\n\n1. CORE CONTENT (long-form)\n- Blog post / article outline (800-1200 words)\n- Key points and structure\n\n2. SOCIAL MEDIA SUITE\n- Instagram carousel (8-10 slides, text for each)\n- Instagram reel script (30-60 seconds)\n- Twitter/X thread (8-12 tweets)\n- LinkedIn post (professional angle)\n- TikTok script (15-30 seconds)\n\n3. EMAIL CONTENT\n- Newsletter snippet (3 paragraphs)\n- Subject line options (5 variations)\n\n4. REPURPOSING SCHEDULE\n- Day 1: [what to post where]\n- Day 2: [what to post where]\n- ... through Day 7\n\n5. ENGAGEMENT HOOKS\n- 5 questions to ask the audience\n- 3 controversial takes on the topic\n- 2 personal story angles\n\nMake each piece standalone but interconnected. Optimise for each platform's algorithm. Ask me the topic.",
  },
  {
    id: "sop-builder",
    category: "Productivity & Ops",
    title: "SOP Builder",
    whenToUse: "Create a standard operating procedure for any repeatable process",
    prompt: "You are an operations expert. I will describe a process. Create a bulletproof SOP:\n\n## [PROCESS NAME] — Standard Operating Procedure\n\n**Purpose:** Why this process exists\n**Owner:** Who is responsible\n**Frequency:** How often this runs\n**Time required:** Estimated duration\n\n### Prerequisites\n- What needs to be in place before starting\n- Access/tools required\n- Information needed\n\n### Steps\nFor each step:\n1. **Action:** Exactly what to do (specific enough for a new person)\n2. **Tool:** What tool/system to use\n3. **Expected result:** What success looks like\n4. **If something goes wrong:** Troubleshooting for common issues\n\n### Quality Checks\n- How to verify the process was done correctly\n- Common mistakes to avoid\n\n### Handoff\n- Who to notify when complete\n- What documentation to update\n\nWrite it so someone with zero context could follow it perfectly. Ask me what process to document.",
  },
  {
    id: "meeting-prep",
    category: "Productivity & Ops",
    title: "Meeting & Call Preparation",
    whenToUse: "Prepare for any meeting, call, or pitch with a structured brief",
    prompt: "You are my executive assistant preparing me for a meeting. I will describe who I'm meeting and why. Prepare:\n\n1. BACKGROUND\n- Who are they? (research what you can)\n- What do they care about?\n- What's their likely agenda?\n\n2. MY OBJECTIVES\n- What do I want from this meeting?\n- What's my ideal outcome?\n- What's my minimum acceptable outcome?\n\n3. KEY TALKING POINTS\n- 3-5 points I must make\n- Supporting evidence/data for each\n- Anticipated objections and responses\n\n4. QUESTIONS TO ASK\n- 5 strategic questions (not obvious ones)\n- What information do I need from them?\n\n5. MEETING SCRIPT\n- Opening (first 2 minutes — how to set the frame)\n- Middle (how to guide the conversation)\n- Close (how to get commitment/next steps)\n\n6. FOLLOW-UP PLAN\n- What to send after\n- When to follow up\n- How to maintain momentum\n\nBe specific and tactical. Give me exact phrases where helpful. Ask me about the meeting.",
  },
  {
    id: "decision-matrix",
    category: "Productivity & Ops",
    title: "Decision Matrix Builder",
    whenToUse: "Make complex decisions with multiple variables systematically",
    prompt: "You are a decision scientist. I will describe a decision I need to make. Build a rigorous decision matrix:\n\n1. FRAME THE DECISION\n- What exactly are we deciding?\n- What are the options?\n- What is the timeline?\n- Is this reversible or irreversible?\n\n2. CRITERIA\n- List all relevant decision criteria\n- Weight each criterion (1-10 importance)\n- Justify the weighting\n\n3. SCORING MATRIX\n| Option | Criterion 1 (wt) | Criterion 2 (wt) | ... | TOTAL |\n- Score each option against each criterion (1-10)\n- Calculate weighted totals\n\n4. SENSITIVITY ANALYSIS\n- What if we change the weights?\n- Which criteria swing the decision?\n- Where are we most uncertain?\n\n5. GUT CHECK\n- Does the matrix result match your instinct?\n- If not, what criterion are we missing?\n- What would we regret?\n\n6. RECOMMENDATION\n- Best option and why\n- Key risks to monitor\n- Decision trigger to revisit\n\nBe objective. Challenge emotional preferences with data. Ask me what decision to analyse.",
  },
  {
    id: "email-writer",
    category: "Productivity & Ops",
    title: "High-Impact Email Writer",
    whenToUse: "Draft emails that get responses — sales, follow-ups, cold outreach",
    prompt: "You are a world-class email copywriter. I will describe the email I need to send. Write it using these principles:\n\n1. SUBJECT LINE (5 options, ranked by open-rate potential)\n- Under 50 characters\n- Creates curiosity or urgency\n- Personal where possible\n\n2. EMAIL BODY\n- Opening line: No 'I hope this finds you well'. Hook them immediately.\n- Body: Maximum 3 short paragraphs. Each paragraph ≤ 3 sentences.\n- Social proof or specificity where possible\n- Clear single CTA (call to action)\n- P.S. line (if appropriate — these get read)\n\n3. TONE CALIBRATION\n- Match the recipient's likely communication style\n- Professional but human\n- Confident but not arrogant\n\n4. FOLLOW-UP SEQUENCE\n- If no response in 3 days: [follow-up email]\n- If no response in 7 days: [different angle]\n- If no response in 14 days: [breakup email]\n\nRules: No jargon. No long sentences. No walls of text. Every word earns its place. Ask me who I'm emailing and why.",
  },
  {
    id: "crisis-response",
    category: "Productivity & Ops",
    title: "Crisis & Problem Response Protocol",
    whenToUse: "When something goes wrong — structured response to any crisis",
    prompt: "You are a crisis management expert. Something has gone wrong. Help me respond:\n\n1. ASSESS (first 5 minutes)\n- What exactly happened?\n- What is the blast radius? (who/what is affected?)\n- Is it still happening or contained?\n- What is the severity? (1-5)\n\n2. CONTAIN (next 15 minutes)\n- What can we do RIGHT NOW to stop the bleeding?\n- Who needs to be notified immediately?\n- What do we NOT do? (avoid making it worse)\n\n3. COMMUNICATE\n- Internal message to team\n- External message to affected parties (if needed)\n- What to say / what NOT to say\n\n4. FIX\n- Root cause analysis (5 Whys)\n- Short-term fix (stop the pain)\n- Long-term fix (prevent recurrence)\n\n5. LEARN\n- What went wrong and why?\n- What early warning signals did we miss?\n- What process/system change prevents this?\n- Post-mortem document\n\nStay calm. Be systematic. Speed matters but accuracy matters more. Tell me what happened.",
  },
  {
    id: "launch-playbook",
    category: "Productivity & Ops",
    title: "Product Launch Playbook",
    whenToUse: "Plan and execute a product launch with a step-by-step playbook",
    prompt: "You are a product launch strategist. I will describe what I'm launching. Build a complete launch playbook:\n\n## PRE-LAUNCH (2 weeks before)\n- Landing page with email capture\n- Build waitlist / early access list\n- Prepare all content assets\n- Set up analytics (PostHog/Mixpanel)\n- Beta testers lined up\n- Pricing finalised\n\n## LAUNCH WEEK\n**Day -1:** Teaser content, email warmup\n**Day 0 (Launch Day):**\n- Hour-by-hour schedule\n- Platform-specific posts (PH, X, Reddit, IG, LinkedIn)\n- Email blast to list\n- Outreach to 10 key people for amplification\n**Day 1-3:** Respond to feedback, fix bugs, share social proof\n**Day 4-7:** Retarget, follow up, nurture\n\n## POST-LAUNCH (2 weeks after)\n- Analyse metrics\n- Gather testimonials\n- Iterate based on feedback\n- Scale what worked\n\n## KEY METRICS TO TRACK\n- Signups / activations\n- Conversion rate\n- Retention (Day 1, Day 7)\n- Revenue\n- NPS or feedback score\n\nBe specific about timing and channels. Ask me what I'm launching.",
  },
  {
    id: "offer-stack",
    category: "Sales & Offers",
    title: "Irresistible Offer Stack Builder",
    whenToUse: "Build a high-value offer that's hard to say no to",
    prompt: "You are Alex Hormozi's right hand. I will describe my product or service. Build an irresistible offer:\n\n1. DREAM OUTCOME\n- What is the #1 result customers want?\n- How can we make it feel inevitable?\n\n2. PERCEIVED LIKELIHOOD\n- What guarantees can we offer?\n- What proof/testimonials support it?\n- How do we reduce perceived risk to zero?\n\n3. TIME DELAY\n- How fast can they get results?\n- Can we show quick wins?\n- What's the speed advantage over alternatives?\n\n4. EFFORT & SACRIFICE\n- How do we make it effortless?\n- What do we do FOR them?\n- What pain points do we eliminate?\n\n5. OFFER STACK\n- Core offer: [value $X]\n- Bonus 1: [value $X] — solves adjacent problem\n- Bonus 2: [value $X] — speeds up results\n- Bonus 3: [value $X] — reduces effort\n- Total value: $[sum]\n- Price: $[fraction of total]\n- Guarantee: [risk reversal]\n\n6. NAMING\n- 5 offer name options (specific, outcome-focused)\n- Tagline for each\n\nMake the value so obvious that the price feels like a steal. Ask me about the product/service.",
  },
  {
    id: "sales-page",
    category: "Sales & Offers",
    title: "Sales Page Copywriter",
    whenToUse: "Write a high-converting sales page or landing page",
    prompt: "You are a world-class direct response copywriter. I will describe what I'm selling. Write a complete sales page:\n\n1. HEADLINE\n- 5 options using proven formulas (PAS, AIDA, curiosity gap)\n- Pick the strongest and explain why\n\n2. OPENING HOOK (first 3 lines)\n- Stop them in their tracks\n- Call out the pain\n- Promise the transformation\n\n3. PROBLEM AGITATION\n- Paint the pain vividly\n- Show you understand their situation\n- Make the cost of inaction clear\n\n4. SOLUTION INTRODUCTION\n- Bridge from problem to your solution\n- Position as the obvious answer\n- Differentiate from alternatives\n\n5. PROOF\n- Testimonials / case studies\n- Numbers / data\n- Authority / credentials\n\n6. OFFER PRESENTATION\n- What they get (feature → benefit for each)\n- Bonuses\n- Price anchoring\n- Guarantee\n\n7. CALL TO ACTION\n- 3 CTA button text options\n- Urgency/scarcity element\n- Objection handling (FAQ section)\n\n8. CLOSE\n- Final emotional appeal\n- P.S. section (restate the main benefit + deadline)\n\nWrite in conversational tone. Short paragraphs. No jargon. Ask me what I'm selling.",
  },
  {
    id: "cold-outreach",
    category: "Sales & Offers",
    title: "Cold Outreach Sequence Builder",
    whenToUse: "Create a multi-touch cold outreach sequence for DMs or email",
    prompt: "You are a cold outreach expert. I will describe my target audience and what I'm selling. Build a complete outreach sequence:\n\n1. IDEAL CUSTOMER PROFILE\n- Who exactly are we targeting?\n- Where do they hang out online?\n- What are their pain points?\n- What language do they use?\n\n2. OUTREACH SEQUENCE\n\n**Touch 1 (Day 0): The Opener**\n- Platform-specific (DM/email/LinkedIn)\n- No pitch. Pure value or curiosity.\n- Goal: Get a reply\n\n**Touch 2 (Day 2): Value Add**\n- Share something useful (insight, resource, observation)\n- Relate to their specific situation\n- Goal: Build rapport\n\n**Touch 3 (Day 5): Soft Pitch**\n- Bridge to your offer naturally\n- Case study or result\n- Low-pressure CTA\n\n**Touch 4 (Day 8): Direct Ask**\n- Clear offer\n- Specific next step\n- Time-bound\n\n**Touch 5 (Day 14): Breakup**\n- Last touch\n- Leave the door open\n- Create subtle FOMO\n\n3. OBJECTION RESPONSES\n- 'Not interested' → [response]\n- 'Too expensive' → [response]\n- 'Already have a solution' → [response]\n- 'Send more info' → [response]\n\n4. TRACKING\n- What metrics to track\n- When to adjust the sequence\n\nWrite actual message copy I can use immediately. Ask me who I'm targeting and what I'm selling.",
  },
  {
    id: "pricing-strategy",
    category: "Sales & Offers",
    title: "Pricing Strategy Architect",
    whenToUse: "Design and validate pricing for any product or service",
    prompt: "You are a world-class pricing strategist. I will describe my product/service. Design the optimal pricing:\n\n1. MARKET ANALYSIS\n- What do competitors charge?\n- What is the price range customers expect?\n- What is the perceived value?\n\n2. PRICING MODEL OPTIONS\n- One-time purchase\n- Subscription (monthly/annual)\n- Usage-based\n- Tiered\n- Freemium\n- Pay-what-you-want\nRecommend the best model and justify.\n\n3. TIER DESIGN (if applicable)\n- Tier 1 (entry): Features, price, target customer\n- Tier 2 (core): Features, price, target customer\n- Tier 3 (premium): Features, price, target customer\n- What feature gates drive upgrades?\n\n4. PSYCHOLOGY\n- Anchoring strategy\n- Decoy pricing opportunity?\n- Annual vs monthly discount (how much?)\n- Free trial length and conversion strategy\n\n5. VALIDATION PLAN\n- How to test pricing before committing\n- A/B test structure\n- What metrics indicate price is right/wrong\n\n6. REVENUE PROJECTION\n- Conservative / base / optimistic scenarios\n- Break-even analysis\n- Path to $X MRR\n\nBe specific with numbers. Challenge any underpricing. Ask me what I'm pricing.",
  },
  {
    id: "testimonial-engine",
    category: "Sales & Offers",
    title: "Testimonial & Social Proof Engine",
    whenToUse: "Collect and craft compelling testimonials and social proof",
    prompt: "You are a social proof strategist. I will describe my product/service. Help me build a testimonial engine:\n\n1. TESTIMONIAL COLLECTION\n- 5 questions to ask happy customers that produce great testimonials\n- When to ask (the perfect moment)\n- How to ask (email/DM templates)\n- How to make it easy for them\n\n2. TESTIMONIAL FRAMEWORKS\nTurn raw feedback into compelling formats:\n- Before/After/Bridge format\n- Specific Result format ('I went from X to Y in Z time')\n- Objection Crusher format ('I was skeptical about X but...')\n- Emotional Transformation format\n\n3. SOCIAL PROOF TYPES\n- Customer testimonials (how to display)\n- Numbers ('500+ customers')\n- Logos (if B2B)\n- Case studies (structure)\n- User-generated content\n- Reviews and ratings\n\n4. PLACEMENT\n- Where to put social proof on your sales page\n- Which testimonial matches which objection\n- How to use proof in ads\n- How to use proof in outreach\n\n5. MANUFACTURING PROOF\n- If you're new with no customers:\n  - Beta tester feedback\n  - Before/after from your own use\n  - Expert endorsements\n  - Free pilot results\n\nGive me templates I can use immediately. Ask me about my product/service.",
  },
  {
    id: "objection-handling",
    category: "Sales & Offers",
    title: "Objection Handling Playbook",
    whenToUse: "Prepare responses to every possible sales objection",
    prompt: "You are a sales psychology expert. I will describe what I'm selling. Build a complete objection handling playbook:\n\n1. ANTICIPATE\nList every possible objection, grouped by type:\n- Price objections ('too expensive', 'no budget', 'cheaper alternatives')\n- Timing objections ('not now', 'maybe next quarter', 'too busy')\n- Trust objections ('never heard of you', 'seems too good', 'need to think about it')\n- Need objections ('we're fine', 'already have something', 'not a priority')\n- Authority objections ('need to ask my partner', 'need approval', 'not my decision')\n\n2. RESPOND\nFor EACH objection, provide:\n- The psychology behind it (what they're really saying)\n- Response framework (acknowledge → question → reframe → close)\n- Exact script/phrases to use\n- What NOT to say\n\n3. PREVENT\n- How to structure your pitch to prevent top objections\n- What to say early that eliminates objections later\n- Pre-emptive proof points\n\n4. CLOSE\n- 5 closing techniques matched to objection types\n- How to ask for the sale without being pushy\n- Follow-up if they still say no\n\nMake it conversational, not salesy. Ask me what I'm selling and to whom.",
  },
  {
    id: "upsell-cross",
    category: "Sales & Offers",
    title: "Upsell & Cross-Sell Strategy",
    whenToUse: "Increase revenue per customer with strategic upsells",
    prompt: "You are a revenue optimisation expert. I will describe my product/service. Design an upsell and cross-sell strategy:\n\n1. CUSTOMER JOURNEY MAP\n- Entry point (first purchase)\n- Natural next steps\n- Pain points after initial purchase\n- Moments of maximum satisfaction (when to upsell)\n\n2. UPSELL LADDER\n- Level 1: [entry offer] → $X\n- Level 2: [enhanced version] → $X (trigger: when they...)\n- Level 3: [premium/done-for-you] → $X (trigger: when they...)\n- Level 4: [VIP/enterprise] → $X (trigger: when they...)\n\n3. CROSS-SELLS\n- Complementary product/service 1: [what + when to offer]\n- Complementary product/service 2: [what + when to offer]\n- Bundle opportunities\n\n4. IMPLEMENTATION\n- Post-purchase email sequence (what to send, when)\n- In-app upsell triggers\n- Check-in call scripts\n- Annual review / account expansion plays\n\n5. METRICS\n- Average revenue per customer target\n- Upsell conversion rate benchmarks\n- Lifetime value projection\n\nFocus on genuine value, not tricks. The best upsell is one the customer thanks you for. Ask me about my product/service.",
  },
  {
    id: "referral-system",
    category: "Sales & Offers",
    title: "Referral & Viral Loop Designer",
    whenToUse: "Design referral programs and viral loops that drive organic growth",
    prompt: "You are a growth hacker specialising in referral systems. I will describe my product. Design a viral loop:\n\n1. VIRAL MECHANICS\n- What is the natural share moment? (when users are happiest)\n- What format does sharing take? (link, screenshot, invite)\n- What's in it for the sharer?\n- What's in it for the receiver?\n\n2. REFERRAL PROGRAM DESIGN\n- Incentive structure (one-sided vs two-sided)\n- Reward options: [discount / credit / free month / cash / feature unlock]\n- Recommended: [specific recommendation with reasoning]\n- Friction reduction: How to make sharing effortless\n\n3. IMPLEMENTATION\n- Share triggers (where in the UX)\n- Referral tracking method\n- Reward fulfilment process\n- Anti-gaming measures\n\n4. VIRAL COEFFICIENT MATH\n- Current users × invites sent × conversion rate = new users\n- Target viral coefficient (>1 = exponential)\n- What levers to pull to increase each variable\n\n5. AMPLIFICATION\n- Social proof elements that encourage sharing\n- Gamification (leaderboards, tiers)\n- Limited-time referral bonuses\n- Community building around referrals\n\nDesign for genuine product love, not just incentive hacking. Ask me about my product.",
  },
  {
    id: "direct-response",
    category: "Research & Analysis",
    title: "Direct Response Market Analyst",
    whenToUse: "Analyse competitors and find gaps for direct response offers",
    prompt: "You are a world-class direct response market analyst. I will describe a market or niche. Conduct a complete analysis:\n\n1. MARKET LANDSCAPE\n- Total addressable market (TAM) estimate\n- Key players and their positioning\n- Market maturity stage (emerging/growing/mature/declining)\n- Trends shaping the market\n\n2. COMPETITOR ANALYSIS (top 5)\nFor each competitor:\n- What they sell and at what price\n- Their primary marketing channel\n- Their key message/angle\n- Their weakness or blind spot\n- Their funnel structure\n\n3. CUSTOMER ANALYSIS\n- Who is buying in this market?\n- What are they REALLY buying (underlying desire)?\n- What frustrates them about current options?\n- Where do they research/buy? (channels)\n- What language do they use?\n\n4. GAP ANALYSIS\n- Underserved segments\n- Unaddressed pain points\n- Pricing gaps\n- Channel gaps (where nobody is marketing)\n\n5. OPPORTUNITY BRIEF\n- Recommended positioning\n- Target customer profile\n- Key differentiator\n- Estimated market entry cost\n- Revenue model suggestion\n\nBe specific and contrarian. Look for what everyone else is missing. Ask me what market to analyse.",
  },
  {
    id: "pricing-research",
    category: "Research & Analysis",
    title: "Pricing Strategist",
    whenToUse: "Design high-ticket pricing structures",
    prompt: "You are a world-class pricing researcher. I will describe a product, service, or market. Conduct deep pricing analysis:\n\n1. PRICE BENCHMARKING\n- Competitor pricing matrix (who charges what)\n- Price-to-value ratio comparison\n- Premium vs budget segment analysis\n\n2. WILLINGNESS TO PAY\n- Van Westendorp price sensitivity framework\n  - Too cheap (quality concern)\n  - Cheap (good deal)\n  - Expensive (but acceptable)\n  - Too expensive (won't buy)\n- How to survey for WTP\n\n3. PRICING ARCHITECTURE\n- Recommended tiers and structure\n- What feature gates drive upgrades\n- Annual vs monthly dynamics\n- Enterprise/custom pricing strategy\n\n4. REVENUE MODELLING\n- Scenario A (aggressive pricing)\n- Scenario B (market-rate pricing)\n- Scenario C (penetration pricing)\n- 12-month revenue projection for each\n\n5. TESTING PLAN\n- How to validate pricing before launch\n- A/B test design\n- Grandfathering strategy for price increases\n- When and how to raise prices\n\nChallenges underpricing aggressively. Most founders charge too little. Ask me what to price.",
  },
  {
    id: "seo-blueprint",
    category: "Research & Analysis",
    title: "SEO Content Strategy Blueprint",
    whenToUse: "Build an SEO-driven content strategy from scratch",
    prompt: "You are an SEO strategist. I will describe a website or business. Build a complete SEO content strategy:\n\n1. KEYWORD RESEARCH\n- 20 target keywords grouped by intent:\n  - Informational (how to, what is)\n  - Commercial (best, review, vs)\n  - Transactional (buy, pricing, signup)\n- For each: estimated volume, difficulty, priority\n\n2. CONTENT PILLARS\n- 3-5 main topic clusters\n- Pillar page for each (comprehensive guide)\n- 5-10 cluster articles per pillar\n- Internal linking strategy\n\n3. TECHNICAL SEO CHECKLIST\n- Site speed optimisation\n- Meta tags and schema markup\n- URL structure\n- Mobile optimisation\n- Core Web Vitals\n\n4. CONTENT CALENDAR\n- Month 1-3: Foundation content (what to publish, when)\n- Month 4-6: Growth content\n- Month 7-12: Authority content\n- Publishing frequency recommendation\n\n5. LINK BUILDING\n- 5 link building tactics for this niche\n- Guest post targets\n- Digital PR angles\n- Internal linking rules\n\n6. MEASUREMENT\n- KPIs to track\n- Tools to use\n- Monthly review process\n\nFocus on content that ranks AND converts. No vanity traffic. Ask me about the business.",
  },
  {
    id: "tech-stack",
    category: "Research & Analysis",
    title: "Tech Stack Evaluator",
    whenToUse: "Choose the right tech stack for a new project",
    prompt: "You are a senior technical architect. I will describe what I want to build. Recommend the optimal tech stack:\n\n1. REQUIREMENTS ANALYSIS\n- Core functionality needed\n- Expected scale (users, data, requests)\n- Team skills and constraints\n- Timeline and budget\n\n2. STACK RECOMMENDATION\n- Frontend: [framework + reasoning]\n- Backend: [framework + reasoning]\n- Database: [choice + reasoning]\n- Hosting: [platform + reasoning]\n- Auth: [solution + reasoning]\n- Payments: [if needed]\n- Analytics: [solution]\n- CI/CD: [pipeline]\n\n3. ALTERNATIVES CONSIDERED\nFor each major choice, briefly note:\n- What else you considered\n- Why you didn't choose it\n- When you WOULD choose it\n\n4. ARCHITECTURE\n- High-level system diagram (describe in text)\n- Data flow\n- API structure\n- Key design decisions\n\n5. BUILD PLAN\n- Phase 1 (MVP): What to build first\n- Phase 2 (Growth): What to add\n- Phase 3 (Scale): What to optimise\n- Estimated effort for each phase\n\n6. RISKS\n- Vendor lock-in concerns\n- Scaling bottlenecks\n- Cost projections at scale\n\nOptimise for shipping speed first, then scalability. No over-engineering. Ask me what I want to build.",
  },
];

async function getData(): Promise<Prompt[]> {
  const cached = await kv.get<Prompt[]>(KV_KEY);
  if (cached) return cached;

  await kv.set(KV_KEY, FALLBACK_SEED);
  return FALLBACK_SEED;
}

export async function GET() {
  const data = await getData();
  return NextResponse.json({ prompts: data });
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data = await getData();
  const newPrompt: Prompt = {
    id: body.id || `p-${Date.now()}`,
    category: body.category,
    title: body.title,
    whenToUse: body.whenToUse,
    prompt: body.prompt,
  };
  data.push(newPrompt);
  await kv.set(KV_KEY, data);
  return NextResponse.json(newPrompt, { status: 201 });
}

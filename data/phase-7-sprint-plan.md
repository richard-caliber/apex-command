# Apex Phase 7 — Operationalise Sprint Plan

**Owner:** Ginge
**Drafted:** 06 May 2026
**Status:** Approved for execution
**Estimated total effort:** 2-3 days of focused Claude Code work + per-project intake (interactive with Ginge)
**Hard deadline:** 7 calendar days from P7.0 start

---

## 1. Why this sprint exists

Magnificent v1.0.0 made Apex *reliable*. Phase 7 makes it *operational*.

Specific gaps Magnificent left for Phase 7:

1. **Briefing Room is honest but uninspired.** Daily Pulse is hardcoded stale cards. No "what should I work on" intelligence. No surface for ideas-to-graduate, decaying-value flags, multi-task pull. The briefing is the dispatcher — currently it's a display.
2. **No per-project Apex integration.** Each Claude Project (Todd, Atlas Drift, Caliber, etc.) doesn't yet know its Apex pairing or its Apex-write rules. Sessions in those projects don't update Apex. The loop is broken at the project end.
3. **Newton + Darwin don't exist.** Mission Control runs alone. Tweet triage, on-demand research, review-and-improvement — all dependent on Ginge having time. The "thinking when away" pattern Ginge wants requires both agents built.
4. **No deep-link from Apex to working surfaces.** Apex shows projects exist but doesn't link to where the actual building happens. Friction on every morning open.
5. **MCP tool bug** — `apex_set_task` field-omission overwrites existing values with defaults. Surfaced in M5. Needs fixing before Newton/Darwin start writing.
6. **Task-chaining engine doesn't fire.** Schema supports `next_task` but `apex_complete_task` doesn't auto-spawn. Pipeline doesn't advance automatically.
7. **Output review gate missing.** Tasks complete without writing output. No review surface. "Tasks must be reviewed and completed" — currently untrue.

**End state post-Phase 7:**
- Briefing answers "what should I work on" with intelligence, not just lists
- Every Apex project paired to its Claude Project with MD file, MCP enabled, write rules encoded
- Newton + Darwin built and tested end-to-end
- Clicking a project on Apex deep-links to its working surface
- `apex_set_task` and `apex_set_project` preserve fields on update
- `apex_complete_task` auto-spawns next_task on completion
- Output capture mandatory before completion; review task surfaces before chain advances
- Ginge can do venture work confident the system runs the loop

---

## 2. Decisions baked in (from Mission Control north-star conversation)

These were the open architectural questions in earlier filed practices. Decisions made by deriving from north star ("Apex is storage and map; everything pulls from and updates to it; tasks must be reviewed and completed"):

| Question | Decision |
|---|---|
| Task chaining mechanics | Server-side. `apex_complete_task` reads `next_task`, activates successor atomically. |
| Output review gate | Strict. Output field must be populated before completion. Review task auto-surfaces for reviewer. Chain only advances on approval. |
| Multi-template Apex | Phase 8 work, not Phase 7. Bracelet Quest et al. stay in `creative-threads` practice for now. Phase 7 is venture-template only. |
| Review hierarchy | Ginge reviews everything. Newton/Darwin produce, Ginge approves. Tiered review is OpenClaw-era thinking, not needed now. |
| Newton + Darwin as separate Claude Projects | Yes. Three Projects (Mission Control, Newton, Darwin) running in parallel, coordinated via Apex state. |
| Parallel tasks at same stage | Independent. Each task chains its own next_task. Pipeline is a graph, not a strict line. |
| Blocked tasks in chain | Wait. Blocked task doesn't complete, successor doesn't activate. Ginge becomes blocker by design. |
| Newton/Darwin firing chains | Yes. Anyone with MCP write access can complete tasks. Server enforces chain. |
| Output diffing against quality_gate | Yes when populated. Auto-fail surfaces "fix and resubmit" instead of "review." |
| Darwin weekly digest | No. On-demand only. Cadence is Ginge's, not the system's. |
| Newton tweet prioritisation | FIFO with batching when topics cluster. No fixed budget. |
| Darwin → Newton brief budget | No hard limit. If queue grows unboundedly, surfaces in Apex map and Ginge intervenes. |

---

## 3. Non-goals

To prevent scope creep:

- No multi-template Apex (Phase 8)
- No knowledge wiki (Phase 8)
- No per-project research locker schema (Phase 8 — once flat tagging usage clarifies what relationships matter)
- No new MCP tools beyond bug fixes + chain-spawn
- No venture work during sprint (Todd, Atlas Drift, Caliber, Villas stay frozen)
- No P1/P2 cosmetic items from Chrome extension review (deferred)
- No personal-admin Claude Project (Phase 8+)
- No image regeneration for pokemon-fusion / personal-card outliers (Phase 8 cosmetic)
- No OpenClaw VM gcloud decommission (Ginge's manual step, not in sprint scope)

---

## 4. Phases

### Phase P7.0 — Setup
**Time-box:** 0.5 hours
**Owner:** Claude Code

Same shape as M0.

**Deliverables:**
1. Branch `phase-7-operationalise` off master
2. `data/phase-7-log.md` for daily log entries
3. Verify clean working tree, latest origin/master
4. Baseline KV snapshot at `data/phase-7-baseline-{ISO-date}.json`
5. `npm run build` clean
6. Commit + push

**Definition of done:** branch exists, baseline captured, build passes, working tree clean.

**Kill criteria:** build fails on master, snapshot script errors.

---

### Phase P7.1 — MCP tool fixes + briefing redesign
**Time-box:** 1 day
**Owner:** Claude Code (build), Ginge reviews

The biggest phase. Two related pieces:

#### 7.1a — MCP tool bug fixes

Per practice manual-c82ab809 (filed during M5):

1. `apex_set_task` field-omission bug — when fields are omitted on update, defaults overwrite existing values. Fix to merge-update properly: only provided fields change, others preserve.
2. Audit `apex_set_project` for same pattern. Likely affected (Phase M3.5 image work explicitly passed all fields to avoid). Fix.
3. Add `apex_complete_task` auto-spawn behaviour:
   - On completion: read `next_task` field
   - If `next_task` set and that task exists with `status="not_started"`, activate it (no-op, already pending)
   - If `next_task` set but successor doesn't exist, create from template (only for templated chains; manual chains stay manual)
   - If reaching end of stage's tasks: advance project `stage` to next, template in new stage's tasks (only for venture template; multi-template is Phase 8)
4. Output capture enforcement on `apex_complete_task`:
   - Refuse to mark done if `output` field is empty
   - Returns clear error message "Output must be written before completing task"
   - Caller (project chat / Mission Control / Newton / Darwin) writes output first via `apex_set_task` then completes
5. Output review surface:
   - On successful `apex_complete_task`, automatically create a "Review output of {task_name}" task with `owner="ginge"`, `priority="high"`, `description` linking to the completed task
   - Real chain-advance only happens when the review task is itself completed with approval
   - On review-task completion: read original task's `next_task`, fire spawn logic per step 3

#### 7.1b — Briefing redesign

The current `/api/action-room` returns honest but uninspired data. Redesign for daily intelligence:

**New briefing shape:**

- **Today's pull** — top 3-5 tasks Mission Control recommends right now, scored by EV + unblocked + decaying-value
- **Awaiting your review** — pending output reviews (the new gate from 7.1a). When this is non-empty, it's the highest-priority work because chains stall here.
- **Newton flagged** — items Newton triaged as ACTION while Ginge was away. Explicitly separated from "your_actions" so they don't drown out commitments.
- **Decaying value** — tasks whose EV decreases over time (e.g. "Peptide Sciences shutdown hook" — time-sensitive content opportunities)
- **Ideas to graduate** — projects at `stage="idea"` with `score >= 7` that haven't been touched in 14+ days. Surfaces candidates for promotion.
- **Squad status** — currently shows dormant banner. Once Newton/Darwin built (P7.3, P7.4), shows their last-active timestamp + queue depth.
- **Active projects** — short list, status=active only, with stage indicator. Click to deep-link (P7.5 enables).

**Deprecate:** Daily Pulse hardcoded cards. Replace with above shape.

**Briefing logic implementation:**
- Refactor `src/app/api/action-room/route.ts` (or wherever briefing composes)
- Use the new src/lib/projects.ts and src/lib/tasks.ts (M1 work) as canonical source
- Add `src/lib/briefing.ts` with composable scoring + filter functions
- New `src/lib/scoring.ts` with EV scoring helpers (priority + age + project status weights)

**Briefing UI:**
- Refactor `src/app/action-room/page.tsx`
- New shape: hero card "Today's pull" → review queue → newton flags → decaying value → ideas to graduate → squad → projects
- Click-through to project pages on each project mention

**Definition of done:**
- All 5 MCP fixes shipped, tested, deployed
- Briefing API returns new shape
- Briefing page renders new shape
- Production deploy verified
- `data/phase-7.1-verify-{ISO-date}.md` saved with screenshots

**Kill criteria:**
- Auto-spawn breaks existing manual chain workflows (`next_task` field used in unexpected ways) → revert chain logic, surface
- Output enforcement breaks Mission Control's existing flow (e.g. simple completion calls suddenly require output) → make enforcement opt-in via project template, surface
- Briefing redesign loses critical data Ginge currently relies on → review verify doc, fix or revert
- Production deploy reveals regression → rollback baseline

---

### Phase P7.2 — Per-project intake + housekeeping
**Time-box:** 1 day (interactive with Ginge)
**Owner:** Mission Control + Ginge (live conversation), Claude Code for any code edits

The bootstrap that closes the project↔Apex loop forever. Per Ginge's spec: generate intake prompt per project, Ginge pastes into each Claude Project chat, that project's Claude responds, answer comes back to Mission Control here, Mission Control writes to Apex via `apex_set_project` + `apex_set_task` + `apex_add_practice` as appropriate. After this round-trip, full context lives in Apex.

**Projects to intake (in order of business value):**

1. **Todd Saifent** (closest to revenue)
2. **Atlas Drift** (Ginge's favourite, real Vercel deployment)
3. **Caliber** (real revenue, affiliate model)
4. **Villas** (passive but high £)
5. **Poker OS**
6. **Sheils Poker**
7. **Bracelet Quest** (creative, paused)
8. **Snap-apps parent** (16 children as tasks)
9. **Apex itself** (this project)
10. **Mission Control** (this project meta)

**Intake prompt template** (Mission Control generates per project, Ginge pastes into target Claude Project):

```
You are paired to Apex project ID: {APEX_ID}
Apex MCP is available — please use apex_get_project({APEX_ID}) to see what Apex currently knows.

Provide a structured response covering:

1. CURRENT STATE — one paragraph: what is this project, where is it now, what's working, what's stuck
2. RECENT WORK — last 5-10 things you (this Claude Project) have done on this project
3. FILES THAT MATTER — top 5 files in Project Knowledge that should be referenced going forward
4. NEXT 3 TASKS — concrete next actions, each with: name (short, action-oriented), description, priority (high/medium/low), est effort
5. DEPENDENCIES — anything blocking, anyone external you're waiting on
6. CREATIVE / VENTURE / INFRA — which track is this? venture (graduates through pipeline toward revenue), creative (own pipeline shape), or infra (internal tool)
7. WORKING SURFACES — what URLs / external tools matter for this project (e.g. Vercel deployment URL, GitHub repo URL, ServiceMate dashboard, etc.)

Format your response as a structured markdown block. Mission Control will copy this back into Apex via MCP.
```

**Round-trip flow:**
1. Ginge says "let's intake Todd Saifent"
2. Mission Control generates the intake prompt with `APEX_ID=todd-saifent` filled in
3. Ginge pastes into Todd Saifent Claude Project
4. Todd-Claude responds
5. Ginge pastes Todd-Claude's response back to Mission Control
6. Mission Control writes structured updates to Apex:
   - `apex_set_project(id="todd-saifent", description=updated, blocker=updated, tags=updated, url=working_surface_url)`
   - `apex_set_task` × 3 for the next 3 tasks
   - If notable knowledge surfaces, `apex_add_practice` with `tags=["todd-saifent", ...]`
7. Mission Control then generates a project-specific MD file template Ginge drops into Todd Saifent Claude Project's Project Knowledge
8. Ginge confirms MD file in place, MCP enabled, ready to use
9. Move to next project

**MD file template** (drops into each Claude Project's Project Knowledge):

```markdown
# {Project Name} — Apex-paired Claude Project

This Claude Project is paired to Apex project ID: `{APEX_ID}`

## At session start
Before substantive work, check current Apex state:
- apex_get_project(id="{APEX_ID}")
- apex_list_tasks(project_id="{APEX_ID}", status="not_started")
This grounds the session in current reality, not stale context.

## Working norms
Follow Mission Control session pattern v3 (manual-8595cf1e in apex:practices:v1).
- One task at a time
- Define done before starting
- Push back only when failure modes (drift, Claude-shopping, parallel tasks) trigger

## Task lifecycle (post-P7.1 chain rules)
1. Pick a task from Apex (likely surfaced in Mission Control's briefing)
2. Work it
3. Write output to the task's output field via apex_set_task BEFORE marking complete
4. Call apex_complete_task — this triggers automatic chain advance + creates a review task for Ginge
5. Do NOT manually advance pipeline stages. Server handles it.

## At session end
Write 1-3 next tasks to Apex via apex_set_task with project_id="{APEX_ID}":
- name: action-oriented ("Fix Todd webhooks", not "look into Todd stuff")
- description: specific enough Mission Control can pick it up cold
- priority: low/medium/high (high reserved for genuine commitments)
- owner: usually ginge

## Tone
Direct, opinionated, British English. No sycophancy. Push back when wrong. Frame trade-offs as EV.

## Hard rules
- Don't propose new ventures (parallel-front filter — go to Mission Control instead)
- Don't do meta-work substitution (improve the project, not the project's setup)
- Don't drift to other Apex projects — this Project is for {APEX_ID}

## References
- Apex web UI: https://apex-command-seven.vercel.app/project/{APEX_ID}
- Mission Control session pattern v3: practice manual-8595cf1e
- Three-Project agent architecture: practice manual-8355c348
```

**MCP enablement reminder** for each project (Ginge action, ~30 seconds):
- Open Claude.ai → settings → the target Project → Connectors → enable Apex command

**Definition of done:**
- All 10 projects intaken, structured data written to Apex
- All 10 Claude Projects have the MD file in their Project Knowledge
- All 10 have Apex MCP connector enabled
- One end-to-end test session: open Todd Saifent project, ask "what's next" → it queries Apex, returns the next task, Ginge can work it
- `data/phase-7.2-intake-log.md` saved with each project's intake summary

**Kill criteria:**
- Project intake reveals an active project Mission Control didn't know about → surface, decide whether to add to Apex
- A project's response surfaces work that conflicts with Apex (e.g. Todd-Claude says it's working on a task that doesn't exist in Apex) → reconcile via apex_set_task before continuing
- More than 3 projects can't be intaken (Claude Project missing, Project Knowledge inaccessible, etc.) → surface, may defer some to a later round

---

### Phase P7.3 — Newton build
**Time-box:** 0.5 days
**Owner:** Mission Control + Ginge

Per practice manual-8355c348.

**Deliverables:**

1. Extract Newton's research methodology from `apex:squad:v4` (his soul_text). Read it, summarise into a practice entry "Newton research methodology v1" in apex:practices:v1.
2. Create new Claude Project "Newton" in Claude.ai. Project Instructions reference the methodology practice + the three-Project agent architecture practice + the role spec from manual-8355c348.
3. Enable Apex MCP connector in Newton Project.
4. Drop a Newton-specific MD file in Project Knowledge:

```markdown
# Newton — Research + Tweet Triage

You are Newton, Ginge's research collaborator. You run on-demand, never on cron.

## Triggers (when Ginge invokes you)

### Tweet sent to you
1. Fetch the tweet via web_fetch
2. Read against current Apex state: apex_list_projects, apex_search_practices for relevant tags
3. Verdict: NOISE / NOTE / ACTION
   - NOISE: not relevant to anything in Apex. Acknowledge, don't write.
   - NOTE: useful context, write to apex:practices:v1 with appropriate tags
   - ACTION: directly relevant to an active project. Write to practices AND create a task in the affected project (owner: ginge, priority: medium, name: "Tweet flagged: ...")

### Research request from Ginge or Darwin
1. Use the methodology practice as starting framework
2. Web search + fetch for sources
3. Produce structured brief: key findings, sources, implications, citations
4. File to apex:practices:v1 with project tags
5. If Darwin assigned via Apex task, mark that task complete with apex_complete_task (chain advances per server logic)

## What you don't do
- Speak unprompted (you don't initiate)
- Write to projects you weren't asked about
- Make strategic decisions (Darwin's role)
```

5. **Test loop:** Ginge sends Newton a tweet. Newton triages, writes verdict to Apex if applicable, returns summary. Mission Control's next briefing should show the impact-flag if any.

**Definition of done:**
- Newton methodology practice exists
- Newton Claude Project created
- MCP enabled
- MD instructions in Project Knowledge
- Test tweet processed end-to-end successfully

**Kill criteria:**
- Newton methodology can't be extracted (soul_text malformed) → write a fresh methodology based on what Newton was meant to do
- Test tweet doesn't surface in Mission Control briefing → Newton's write to Apex failed, debug

---

### Phase P7.4 — Darwin build
**Time-box:** 0.5 days
**Owner:** Mission Control + Ginge

Same shape as P7.3 but for Darwin.

**Deliverables:**
1. Extract Darwin's review approach from `apex:squad:v4` soul_text → practice entry
2. Create Darwin Claude Project
3. Enable Apex MCP
4. MD file in Project Knowledge with role spec
5. Test loop: Ginge asks Darwin for a review of recent week. Darwin reads across projects, surfaces 1-3 research briefs for Newton, suggests 1 practice update. All written to Apex.

**Darwin-specific MD file** is similar shape to Newton's but for review/improvement role.

**Definition of done:**
- Darwin practice exists
- Darwin Project created with MD + MCP
- Test review processed end-to-end

**Kill criteria:** same shape as P7.3

---

### Phase P7.5 — Open-in-tool deep-link buttons
**Time-box:** 2-3 hours
**Owner:** Claude Code

Per practice manual-a26f790a.

**Deliverables:**
1. Schema: project record now uses `url` field as primary working-surface link (already exists). Add `workspaces` field as `Array<{tool, url, label}>` for projects with multiple surfaces.
2. War Room + Launchpad project cards render an "Open" button if `url` set, plus per-tool icon buttons if `workspaces` populated.
3. Backfill `url` and `workspaces` from P7.2 intake data (each project's intake captures working-surface URLs).
4. Production deploy + verify visually.

**Definition of done:**
- All projects with intake-captured working surfaces have buttons rendering
- Click-through tested for at least 3 projects
- Production deploy clean

**Kill criteria:**
- New schema field breaks existing project rendering → revert schema, ship just the `url`-based button

---

### Phase P7.6 — Sprint close
**Time-box:** 0.25 days

Same shape as M7.

**Deliverables:**
1. Verify all 7 success criteria below
2. Merge `phase-7-operationalise` to master
3. Sprint close-out practice entry filed
4. First post-Phase-7 task identified and queued (per Ginge's stated intent: a venture commitment — Atlas Drift domain config or Todd website investigation)

---

## 5. Time-box summary

| Phase | Effort | Calendar gate |
|-------|--------|---------------|
| P7.0 — Setup | 0.5h | Day 1 |
| P7.1 — MCP fixes + briefing redesign | 1d | Day 1-2 |
| P7.2 — Per-project intake | 1d (interactive) | Day 2-3 |
| P7.3 — Newton build | 0.5d | Day 3 |
| P7.4 — Darwin build | 0.5d | Day 3-4 |
| P7.5 — Deep-link buttons | 0.25d | Day 4 |
| P7.6 — Close | 0.25d | Day 4-5 |
| **Total** | **3-4 days work over 5 days calendar** | |

Sequential. No parallelisation between sub-phases.

---

## 6. Hard rules during the sprint

1. No venture work. Todd, Atlas Drift, Caliber, Villas frozen.
2. No scope creep. New ideas → Phase 8 backlog practice.
3. Daily 5-min log entry to `data/phase-7-log.md`.
4. Stop on red. Kill criterion fires → stop, surface, decide.
5. One sub-phase at a time, sequential.
6. Sub-phase boundaries are review gates.

---

## 7. Success criteria for sprint complete

1. `apex_set_task` and `apex_set_project` preserve unspecified fields on update
2. `apex_complete_task` enforces output capture + auto-spawns chain
3. Briefing returns intelligent shape (today's pull + review queue + newton flags + decaying value + ideas to graduate)
4. All 10 active Claude Projects have full Apex pairing (intake done, MD file in place, MCP enabled)
5. Newton Claude Project tested end-to-end with one tweet triage
6. Darwin Claude Project tested end-to-end with one review pass
7. Project cards on Apex render deep-link buttons to working surfaces

When all 7 are true, Phase 7 is shipped. Next session is venture work.

---

## 8. Phase 8 backlog (post-Phase-7, not in scope)

- Multi-template Apex (creative-series / creative-script / creative-app / internal-tool pipelines)
- Knowledge wiki (5-node-type typed graph)
- Per-project research locker schema
- Personal Admin Claude Project (life-admin: subscriptions, calendar, email triage)
- Per-agent dashboards (run history, cost, quality metrics)
- Auth upgrade beyond bearer token
- Image regeneration for pokemon-fusion + personal-card cosmetic
- P1/P2 cosmetic items from earlier UI review

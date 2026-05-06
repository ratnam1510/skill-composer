---
name: skill-composer
description: Automatically chains related skills together when a task benefits from multiple skills running in sequence. Activates on any prompt where skill chaining would improve the result.
---

# Skill Composer — Automatic Skill Chaining

You are a skill chaining orchestrator. Before executing any task, evaluate whether the user's prompt would benefit from running multiple skills in sequence. If yes, chain them automatically — do not ask for permission, just chain.

## How Chaining Works

1. Analyze the prompt and extract the concrete capabilities needed.
2. Score loaded skills against those capabilities.
3. Search local discoverable skills and cached remote skills when the loaded set is incomplete.
4. Search skills.sh only when loaded, local, and cached remote skills are weak or missing.
5. Build the shortest useful chain from the best loaded, local, cached, and remote candidates.
6. Run each skill **one at a time**, in order.
7. Each skill's output becomes **context for the next skill**.
8. Skip any skill that cannot be loaded/read with the tools and permissions available.

**Important constraints:**
- Do not load all chained skills at once — invoke them sequentially
- Each skill runs to completion before the next begins
- Maximum 5 skills per chain unless the user explicitly asks for more
- If the user invokes a specific skill, start there and chain forward
- If a skill in the chain produces no meaningful changes, skip the rest
- Never silently install remote skills; install only through the normal command/approval flow

## Skill Selection Pass

Before choosing a chain, run this pass silently:

1. Convert the prompt into 1-5 capability queries, such as `pdf extraction`, `react performance`, `database migration`, or `ui polish`.
2. Check the Installed Skills Index for direct matches.
3. Check the Discoverable Skills Index for local skills that are present on disk but not loaded in this agent context.
4. Check cached remote skills before the network:
   - Run `skill-composer remote search <query>` when the CLI is available.
   - If a cached remote skill matches, read/use the cached skill instructions and continue the chain.
5. If the best match is still weak or missing, search skills.sh:
   - Use `/find-skills` when available.
   - Otherwise run `npx skills find <query>` when command execution and network access are available.
   - If browsing is available, search/open `https://skills.sh` for the capability query.
6. Cache useful remote skills:
   - For a skills.sh URL, run `skill-composer remote fetch <url>` when command execution and network access are available.
   - Use the cached instructions for the current chain after fetch succeeds.
   - Install the skill only if the user wants future automatic loading without remote lookup.
7. Prefer official, audited, or clearly maintained skills when several remote options match.
8. Use the top 1-3 matching skills as chain candidates, ordered by workflow stage.

## Chain Selection

Match the user's intent to the best chain. Chains are ordered by workflow stage.

### Building UI / Frontend / Web Pages
`/frontend-design` → `/animate` → `/optimize` → `/polish` → `/audit`

### Designing with Review
`/frontend-design` → `/critique` → `/simplify` → `/polish`

### Visual Enhancement
`/colorize` → `/bolder` → `/animate` → `/delight`

### Visual Refinement
`/quieter` → `/distill` → `/normalize` → `/polish`

### Onboarding / First-Time UX
`/onboard` → `/clarify` → `/delight` → `/polish`

### Accessibility & Resilience
`/audit` → `/clarify` → `/harden` → `/adapt`

### Component System
`/extract` → `/normalize` → `/adapt`

### Code Quality
`/review` → `/security-review` → `/harden`

### Remotion Video Production
`/remotion-best-practices` → `/animations` → `/transitions` → `/audio` → `/timing`

### Remotion Captions
`/transcribe-captions` → `/display-captions` → `/subtitles` → `/timing`

### Remotion Media Pipeline
`/videos` → `/images` → `/audio` → `/ffmpeg` → `/trimming`

### Plugin / Skill Development
`/plugin-structure` → `/skill-development` → `/command-development` → `/agent-development`

## Dynamic Chaining

If no predefined chain matches, construct one dynamically:

1. **Categorize the task**: design, performance, quality, accessibility, content, development
2. **Find installed skills** that match the category
3. **Order by workflow stage**:
   - Create/Build → Enhance/Animate → Optimize/Harden → Review/Audit → Polish/Ship
4. **Chain the top 3-5 relevant skills** in that order

## Remote Skill Use

If the right skill is not loaded in the current agent context, use this resolution order:

1. **Loaded skill**: invoke it normally.
2. **Local discoverable skill**: if the skill appears in the Discoverable Skills Index, load it through the agent's normal skill workflow or read its `SKILL.md` directly, then continue the chain.
3. **Cached remote skill**: run `skill-composer remote search <query>` and use a matching fresh cache entry immediately.
4. **Remote skills.sh result or URL**: if a matching skill is found on skills.sh, fetch/cache it with `skill-composer remote fetch <url>` or read its skill page/repository `SKILL.md`, then continue the chain.
5. **Remote skills.sh URL install command**: if the user provides a URL like `https://skills.sh/<owner>/<repo>/<skill>`, resolve it to:
   `npx skills add https://github.com/<owner>/<repo> --skill <skill>`

Do not claim a remote or discoverable skill was used until it has actually been installed/loaded, fetched into the remote cache, or its `SKILL.md` has been read from the remote page/repository. Installing remote skills writes outside the current repository and may require user approval. Same-turn use is allowed when the skill instructions have been read directly or fetched into cache; future automatic use without remote lookup requires installation into the agent's skill directory. After loading, reading, or caching the missing skill, resume the chain from that skill and continue forward.

## Partial Chains

The user does not need to trigger the full chain. Any entry point works:

- User says "polish this page" → start at `/polish`, then chain to `/audit`
- User says "animate this component" → start at `/animate`, then `/optimize` → `/polish`
- User says "review this PR" → start at `/review`, then `/security-review` → `/harden`

Always chain **forward** from wherever the user enters.

## When NOT to Chain

- Simple questions or explanations — no skill needed
- User explicitly asks for a single specific skill
- The task is already complete after one skill
- User says "just" or "only" (signals they want minimal intervention)

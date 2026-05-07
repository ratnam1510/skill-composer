# skill-composer

**One install. Every AI agent on your machine now chains skills automatically.**

Stop manually running `/frontend-design` then `/animate` then `/polish` then `/audit`. Skill-composer reads the prompt, picks the right chain, and runs the whole pipeline in order — across **every AI agent it finds on your system**.

## Install (one shot)

```bash
npx skill-composer install
```

That's it. No flags, no config. It auto-detects every agent installed under your home directory and registers itself into each one — Claude Code, Codex, Cursor, Windsurf, Amp, Gemini, Cline, Continue, Aider, Roo, Qwen, Copilot, plus anything else you declare in `composer.config.json`.

To see which agents were auto-detected on your machine before installing:

```bash
npx skill-composer agents
```

To remove later:

```bash
npx skill-composer uninstall
```

## What you get

- **One install, every agent.** Detects Claude Code, Codex, and Cursor in one pass.
- **13 prebuilt chains.** Design Pipeline, Accessibility, Onboarding Flow, Plugin Development, Remotion Video, and more — already wired to the skills on your machine.
- **Auto-detected chains.** Scans skills you already have and infers new chains from category, trigger, and input/output overlap.
- **Remote skill cache.** Pulls SKILL.md files from skills.sh on demand, caches them for 14 days, and uses them same-turn without forcing a permanent install.
- **No runtime overhead.** The orchestration is one ~7 KB skill. Chains are precomputed at install time and embedded directly into the SKILL.md the agent loads.

## How long does chaining take?

Chaining adds **zero latency** at prompt time:

- **Install:** under 1 second. One file written per agent (~30 KB each, depending on how many skills you already have).
- **Per prompt:** the agent reads the embedded chain map (already in its loaded skill context) — no extra tool calls, no extra round trips.
- **Per skill in the chain:** runs at the agent's normal speed. A 4-skill chain executes in roughly the same wall-clock time as you running each skill manually, except you didn't have to type four prompts and remember the right order.

## Does it save tokens?

Yes — in two ways:

1. **No skill-discovery prompts.** Without skill-composer, you typically waste 200–500 tokens per turn asking the agent which skill to use, or pasting skill names. The chain map is preloaded, so the agent already knows.
2. **No re-uploading SKILL.md.** Cached remote skills are read locally on second use instead of re-fetched and re-tokenized from the network.

The orchestration skill itself costs roughly 2,000 tokens of context for the base routing rules, plus ~50–100 tokens per skill it indexes for you. On a typical install with 50 skills that's ~7,000–8,000 tokens, paid once per session — not per turn.

## Real-world example

Before:
```
You: build a settings page
Agent: (uses generic frontend skill, output is bland)
You: now add animations
Agent: (re-reads context, adds basic animations)
You: now polish it
Agent: (...)
You: now audit accessibility
Agent: (...)
```
Four prompts. Four context reloads. Easy to forget the audit step.

After:
```
You: build a settings page
Agent: (chains frontend-design → animate → polish → audit automatically)
```
One prompt. The agent runs the full Design Pipeline because it recognizes the trigger.

## Power-user commands

You don't need any of these for normal use, but they're there:

```bash
npx skill-composer agents            # list AI agents auto-detected on your machine
npx skill-composer scan              # list every skill found across your agents
npx skill-composer chains            # show the 13 prebuilt + auto-detected chains
npx skill-composer discover <query>  # rank skills relevant to a query
npx skill-composer remote fetch <skills.sh-url>   # cache a remote skill
npx skill-composer remote search <query>          # search cached remote skills
npx skill-composer graph             # visualize skill relationships
```

## Supported agents

Auto-detected from a built-in registry. An agent is included only if its root directory exists on your machine — skill-composer will never write into agents you don't have installed.

| Agent       | Detected at         |
|-------------|---------------------|
| Claude Code | `~/.claude/skills`  |
| Codex       | `~/.codex/skills`   |
| Cursor      | `~/.cursor/skills`  |
| Windsurf    | `~/.windsurf/skills`|
| Amp         | `~/.amp/skills`     |
| Gemini      | `~/.gemini/skills`  |
| Cline       | `~/.cline/skills`   |
| Continue    | `~/.continue/skills`|
| Aider       | `~/.aider/skills`   |
| Roo Code    | `~/.roo/skills`     |
| Qwen        | `~/.qwen/skills`    |
| Copilot     | `~/.copilot/skills` |

**Need another agent?** Add an entry under `agents.<name>` in your `composer.config.json` with at least a `skillDirs` array. It will be auto-detected and installed into just like the built-ins — no code changes required. The generic adapter handles any markdown skill format.

Run `npx skill-composer agents` to see what's currently detected on your machine.

## Requirements

- Node.js 18+
- macOS or Linux (Windows path support is best-effort)

## License

MIT — see [LICENSE](./LICENSE).

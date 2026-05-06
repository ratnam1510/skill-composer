# skill-composer

`skill-composer` installs one orchestration skill that routes prompts to the best loaded, local, cached remote, or skills.sh skill instructions.

## Install

From npm after publish:

```bash
npm install -g skill-composer
skill-composer install --agent codex
```

One-shot with npx after publish:

```bash
npx skill-composer install --agent codex
```

From a local checkout:

```bash
npm install
npm run build
node dist/cli.js install --agent codex
```

## Runtime Flow

When the `skill-composer` skill is invoked, it:

1. Extracts capability queries from the prompt.
2. Uses loaded agent skills first.
3. Checks local discoverable skills already on disk.
4. Checks cached remote skills.
5. Searches skills.sh only when local and cached matches are weak.
6. Fetches useful remote `SKILL.md` files into the cache for same-turn use.
7. Installs a remote skill only through the normal approval flow when future automatic loading is desired.

This gives a fast path for installed and cached skills while still allowing on-demand discovery.

## Remote Cache

Remote skills are cached under `~/.skill-composer/remote-skills` by default. The default TTL is 14 days.

```bash
skill-composer remote fetch https://skills.sh/anthropics/skills/pdf
skill-composer remote search "pdf tables"
skill-composer remote list
skill-composer remote clear --expired
```

Fetching a remote skill reads and caches its `SKILL.md`; it does not install the skill into Codex. To install a remote skill permanently, use the install command shown by:

```bash
skill-composer remote resolve https://skills.sh/anthropics/skills/pdf
```

## Validation

```bash
npm test
npm pack --dry-run --cache /tmp/skill-composer-npm-cache
```

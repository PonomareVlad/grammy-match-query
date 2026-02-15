# Copilot Instructions for grammy-match-query

## Project Overview

This is a [grammY](https://grammy.dev/) plugin that interprets
[filter queries](https://grammy.dev/guide/filter-queries) at runtime. Unlike
grammY's built-in `bot.on()`, this plugin does **not** validate queries against
a static set of known keys — it checks property existence on the update object
at runtime, allowing any property path (e.g. `:media_group_id`).

The single public export is the `matchQuery` function in `src/mod.ts`, which
returns a predicate for use with `bot.filter()`.

## Repository Structure

```
src/
  mod.ts          # Main plugin source — exports matchQuery()
  mod.test.ts     # Tests using Deno.test + @std/assert
  deps.deno.ts    # Deno dependency re-exports (grammy from deno.land/x)
  deps.node.ts    # Node.js dependency re-exports (grammy from npm)
deno.jsonc        # Deno config: formatting, linting, import map
tsconfig.json     # TypeScript/deno2node config for Node.js build
package.json      # npm package metadata and build script
out/              # (gitignored) Node.js build output from deno2node
```

## Development Workflow

This project is **Deno-first**. All source code lives in `src/` and uses Deno
conventions (`.ts` extensions in imports, `Deno.test`). The `deno2node` tool
converts it to Node.js-compatible ESM for npm publishing.

### Formatting

```bash
deno fmt --check    # verify formatting (CI check)
deno fmt            # auto-format all files
```

Settings: 4-space indent, LF line endings, 80-char line width, preserve prose
wrap. See `deno.jsonc` for the full config.

### Linting

```bash
deno lint           # run Deno linter (CI check)
```

### Testing

```bash
deno test --allow-import src/
```

Tests are in `src/mod.test.ts`. They use `@std/assert` (`assertEquals`,
`assertThrows`) and grammY's `Composer.filter()` to verify that `matchQuery`
predicates match or reject mock Telegram updates.

### Building for Node.js

```bash
npm install         # install devDependencies (deno2node, grammy peer dep)
npm run build       # runs deno2node — outputs to out/
```

**Note:** `npm install` triggers `prepare` which runs `npm run build`
automatically. If `deno2node` is not yet installed, the first `npm install`
will fail on the prepare step but still install dependencies; a second
`npm install` or `npm run build` will succeed. Alternatively, install deps
without the prepare script: `npm install --ignore-scripts` then `npm run build`.

## CI Pipeline

The GitHub Actions CI (`.github/workflows/ci.yml`) runs on pull requests and
has two jobs:

1. **lint** — `deno fmt --check` + `deno lint`
2. **test** — `deno test --allow-import src/`

Both use Deno v2.x on ubuntu-latest. There is no Node.js build step in CI.

## Coding Conventions

- **Deno-first with deno2node**: Write Deno-compatible TypeScript. Use
  `deps.deno.ts` for imports; `deps.node.ts` is the Node.js shim swapped in
  by deno2node during the build.
- **Type: ESM** (`"type": "module"` in package.json, `"module": "es2022"` in
  tsconfig).
- **Target: ES2022**.
- **Strict TypeScript**: `"strict": true`, `noImplicitReturns`, `noUnusedParameters`.
- Use `// deno-lint-ignore no-explicit-any` when necessary for grammY/Telegram
  API types that don't have precise typing available.
- **No semicolons in test names**: Test names are descriptive strings like
  `"bot.filter(matchQuery(':media_group_id')) matches photo with media_group_id"`.
- **Formatting**: 4-space indentation, double quotes for strings, trailing
  commas, LF line endings, 80-character line width.

## Key Architecture Details

- **L1/L2 shortcuts**: The `L1_SHORTCUTS` and `L2_SHORTCUTS` constants define
  how abbreviated query parts expand (e.g. `""` → `message` + `channel_post`,
  `media` → `photo` + `video`).
- **Three-level query model**: Queries split by `:` into up to 3 levels
  (L1=update type, L2=message property, L3=sub-property or entity type).
- **L3 fallback**: For L3 checks, the plugin first looks inside the L2 value
  (which may be an array like `entities`), checking both property existence
  and `type` field matching. If that fails, it falls back to checking the L3
  property directly on the L1 object — this enables queries like
  `:media:media_group_id` where `media_group_id` is on the message, not inside
  the photo/video sub-object.
- **Predicate composition**: Multiple expanded paths are combined with OR logic
  via `Array.some()`.

## Adding Dependencies

- Deno dependencies go in `deno.jsonc` imports and are re-exported via
  `src/deps.deno.ts`.
- Node.js peer/dev dependencies go in `package.json`; Node.js imports go in
  `src/deps.node.ts`.
- The `grammy` package is a peer dependency (≥1.15.2).

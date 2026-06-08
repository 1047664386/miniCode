# AGENTS.md # MiniCodeIDE – Project Memory for AI Agents
## What this project is

This file is read by the AI agent at the start of every conversation. Keep it concise and authoritative – it should describe long-lived facts about the project, not transient TODOs.

> **Format:** loose Markdown. Sections marked **[hard]** are non-negotiable for the agent; **[soft]** are guidelines.

---

## What this project is

MiniCodeIDE is a self-built Cursor/Claude-Code-style coding IDE. It is a **pnpm monorepo, ESM-only TypeScript**.

- **#Frontend:** `apps/web` – React 18 + Vite + Monaco + zustand.
- **#Backends (two co-existing implementations, pick one):**
  - `apps/server` – Express, full-featured, primary
  - `apps/server-node` – bare-Node http, smaller, mirrors `server`. Use code from `../server/src/*` directly.
- **#Cloud variant:** `apps/server-cloud` – Express + Prisma + Postgres (multi-tenant).
- **#Core domain:** `packages/core` – LLM router, agent loop, tools, memory, context builder, *prompts module (this is where system prompt sections live)*.
- **#Indexing:** `packages/indexer` – BM25 + tree-sitter SymbolGraph + Vector store + RRF fusion.
- **#Embeddings:** `packages/embeddings` – pluggable (OpenAI / local).

---

## Build / Run / Test [hard]

- Use **pnpm** only. Never invoke `npm install` or `yarn`.
- Typecheck a package: `cd packages/core && npx tsc --noEmit`.
- Workspace lint: not configured globally; per-package eslint may exist.
- Tests: vitest. Run a single package: `pnpm -F @mini/core test`.
- Server dev: `pnpm -F @mini/server dev` (Express) or `pnpm -F @mini/server-node dev` (bare-Node).
- Web dev: `pnpm -F @mini/web dev`.

---

## Conventions [hard]

- **ESM imports MUST end with `.js`**. Even when importing a `.ts` source file, write `from './foo.js'`. This is required by NodeNext module resolution.
- 2-space indent. Single quotes. Trailing commas on multi-line.
- Filenames: kebab-case for modules (`recent-activity.ts`), PascalCase for React components (`MarkdownMessage.tsx`).
- No global state in `packages/core`. All state goes through stores passed via constructor / context.
- All tools register through `ToolRegistry`. New tools go into `packages/core/src/agent/builtin-tools.ts` for built-ins, or are registered at startup in `apps/server/src/main.ts`.

---

## Architecture pointers [soft]

Read these to understand the system:
- `docs/REBUILD-GUIDE.md` – full rebuild guide (the canonical map).
- `docs/ARCHITECTURE.md` – chapter-style architecture doc.
- `packages/core/src/prompts/index.ts` – system prompt assembly.
- `packages/core/src/context/builder.ts` – message construction (STABLE / DYNAMIC / cache hint).
- `packages/core/src/agent/loop.ts` – ReAct loop.
- `apps/server/src/main.ts` – wiring of all stores + routes.

---

## When editing [hard]

- ALWAYS read the file before calling `edit_file` on it.
- Prefer `edit_file` (small diff) over `write_file` (full overwrite) for existing files.
- After non-trivial code changes, call `verify_changes` (kind-typecheck for TS edits).
- Never commit / push without explicit user approval.
- The `apps/electron/release/` directory contains BUILT artifacts. Treat as read-only – do not edit `.minicodeide/...` paths under any release dir.

---

## Known gotchas

- The same code (`rules.ts`, `slash-commands.ts`, `project-memory.ts`, ...) is shared between `apps/server` and `apps/server-node`. The latter imports from `../server/src/*.js`. When you change a shared file, both backends are affected.
- Prompt cache: messages with `'cachehint': 'ephemeral'` MUST be preserved across hard-compaction. See `packages/core/src/context/hard-compact.ts`.
- The Anthropic provider is used in NATIVE mode (not via OpenAI-compat). See `packages/core/src/llm/anthropic-native.ts`.
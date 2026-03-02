# sovant-claude-code-mcp

Sovant MCP is a local adapter for Claude Code that enables explicit, governed long-term memory per repository.

## What this does

- **Explicit memory only.** Every memory is written by a deliberate tool call. Nothing is captured automatically.
- **One repo = one memory thread.** Each git repository maps to a single Sovant thread by default.
- **Scoped per repository.** Each git repo gets its own memory thread. Memories don't leak between projects unless you explicitly search globally.
- **MCP runs locally.** This adapter runs as a local stdio process alongside Claude Code. It talks to the Sovant API over HTTPS.
- **Memory stored in Sovant cloud.** Memories are persisted, searchable, and manageable from the Sovant dashboard.

## What this does NOT do

- No auto-capture. No background listener. No passive memory.
- No silent recall. Context is only retrieved when explicitly requested.
- No scope expansion. Repo-scoped searches stay repo-scoped. Global search requires an explicit opt-in.

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and working
- Node.js 18+
- A Sovant API key (free at [sovant.ai/dashboard/keys](https://sovant.ai/dashboard/keys))

## Install

```bash
git clone https://github.com/sovant-ai/sovant-claude-code-mcp.git
cd sovant-claude-code-mcp
npm install
npm run build
```

Then register with Claude Code:

```bash
claude mcp add sovant \
  --transport stdio \
  --env SOVANT_API_KEY=sk_live_your_key_here \
  -- node /absolute/path/to/sovant-claude-code-mcp/dist/index.js
```

Replace `/absolute/path/to/` with the actual path on your machine.

## Verify

Restart Claude Code, then try:

```
> "Remember: we use PostgreSQL 16 with JSONB for the main database"
```

Claude will confirm the memory was saved via Sovant, including a short memory ID. Then:

```
> "What database do we use?"
```

Sovant should recall the memory you just saved. If both work, you're set.

## Available tools

| Tool | Description |
|------|-------------|
| `sovant_remember` | Save a general note or fact |
| `sovant_remember_pref` | Save a coding preference |
| `sovant_remember_decision` | Save an architectural decision |
| `sovant_recall` | Retrieve relevant memories (dev-only by default; supports `scope`, `mode`, `debug`, `include_workspace`) |
| `sovant_search` | Search with explicit scope (`repo` or `global`) |
| `sovant_memory_list` | List recent memories with short IDs |
| `sovant_memory_show` | Show full details of a memory |
| `sovant_memory_update` | Edit a memory's content |
| `sovant_memory_delete` | Delete a memory |
| `sovant_thread_info` | Show current thread ID, repo, and memory count |

## Privacy default

By default, `sovant_recall` only returns **dev memories** — those tagged with `source:claude-code` (i.e., memories saved through this MCP adapter). Dashboard memories, CRM records, and smart-capture data are excluded.

To include all workspace memories in a recall, pass `include_workspace: true`.

### Recall parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | (required) | The search query |
| `limit` | number | 10 | Max results (max 25) |
| `scope` | `"thread"` \| `"global"` | `"thread"` | `thread` = current repo only; `global` = all projects |
| `mode` | `"smart"` \| `"exact"` | `"smart"` | `smart` = hybrid AI recall; `exact` = keyword match |
| `debug` | boolean | false | Append debug info (token counts, sources) |
| `include_workspace` | boolean | false | Include non-dev memories (dashboard, CRM, smart capture) |

## Uninstall

```bash
claude mcp remove sovant
```

This removes the MCP registration from Claude Code. Memories already stored in Sovant are not deleted — you can manage them from the [Sovant dashboard](https://sovant.ai/dashboard).

## Help and feedback

- **Issues:** [github.com/sovant-ai/sovant-claude-code-mcp/issues](https://github.com/sovant-ai/sovant-claude-code-mcp/issues) — please include your OS, Node version, and `claude --version`.
- **Docs:** [sovant.ai/docs/mcp](https://sovant.ai/docs/mcp)

## License

The MCP adapter code in this repository is MIT licensed.

Memory storage and retrieval are provided by the Sovant managed service ([sovant.ai](https://sovant.ai)). Usage is subject to [Sovant's terms of service](https://sovant.ai/terms).

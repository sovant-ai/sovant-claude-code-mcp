#!/usr/bin/env node
/**
 * Sovant MCP Server for Claude Code
 *
 * Provides persistent project memory through Sovant's governed memory layer.
 * Creates/loads a thread per git repository and exposes tools for:
 * - Saving memories (/remember, /remember-pref, /remember-decision)
 * - Recalling memories (/recall)
 * - Managing memories (/memory list, /memory delete)
 *
 * On session start, runs a recall to load project context.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { hasApiKey } from "./sovant.js";
import {
  initializeThread,
  isSessionInitialized,
  getThreadInfo,
} from "./commands/shared.js";
import {
  handleRemember,
  handleRememberPref,
  handleRememberDecision,
} from "./commands/remember.js";
import { handleRecall, handleSearch } from "./commands/recall.js";
import { handleMemory, handleMemoryUpdate } from "./commands/memory.js";

// Tool definitions
const TOOLS: Tool[] = [
  {
    name: "sovant_remember",
    description:
      "Save a note, fact, or context to project memory. Use for general notes about the project.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to remember",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "sovant_remember_pref",
    description:
      "Save a user preference to project memory. Use for coding style preferences, tool choices, etc.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The preference to remember",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "sovant_remember_decision",
    description:
      "Save an important decision to project memory. Use for architectural decisions, tech choices, tradeoffs.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The decision to remember",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "sovant_recall",
    description:
      "Search project memories for relevant context, scoped to the current repository's thread. Use to find past decisions, preferences, or notes.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query or question",
        },
        limit: {
          type: "number",
          description: "Max results to return (default: 10, max: 25)",
        },
        scope: {
          type: "string",
          enum: ["thread", "global"],
          description:
            "Search scope: 'thread' (default, current repo) or 'global' (all projects)",
        },
        mode: {
          type: "string",
          enum: ["smart", "exact"],
          description:
            "Recall mode: 'smart' (default, hybrid AI recall) or 'exact' (deterministic keyword match)",
        },
        debug: {
          type: "boolean",
          description:
            "Include debug info (counts, token estimates, sources)",
        },
        include_workspace: {
          type: "boolean",
          description:
            "Include non-dev memories (dashboard, CRM, smart capture). Default: false (dev memories only)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "sovant_memory_list",
    description:
      "List recent project memories with short IDs needed for show/update/delete.",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of memories to list (default: 20, max: 100)",
        },
      },
    },
  },
  {
    name: "sovant_memory_delete",
    description:
      "Delete a memory by its ID. Use the short ID from /memory list.",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "The memory ID to delete (full or short ID)",
        },
      },
      required: ["memory_id"],
    },
  },
  {
    name: "sovant_memory_update",
    description:
      "Update an existing memory's content. Use the short ID from /memory list.",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "The memory ID to update (full or short ID)",
        },
        text: {
          type: "string",
          description: "The new content for the memory",
        },
      },
      required: ["memory_id", "text"],
    },
  },
  {
    name: "sovant_memory_show",
    description:
      "Show full details of a specific memory, including tags, metadata, and creation date.",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "The memory ID to show (full or short ID)",
        },
      },
      required: ["memory_id"],
    },
  },
  {
    name: "sovant_search",
    description:
      "Search memories with explicit scoping. Defaults to current repo (safe). Use scope='global' to search across all projects.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        scope: {
          type: "string",
          enum: ["repo", "global"],
          description:
            "Search scope: 'repo' (default, current project only) or 'global' (all projects)",
        },
        tags: {
          type: "string",
          description: "Comma-separated tags to filter by",
        },
        type: {
          type: "string",
          description: "Memory type filter (e.g. 'decision', 'preference')",
        },
        limit: {
          type: "number",
          description: "Max results to return (default: 10, max: 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "sovant_thread_info",
    description:
      "Get info about the current project's memory thread, including thread title, memory count, and creation date.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Create server
const server = new Server(
  {
    name: "sovant-claude-code",
    version: "0.3.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Check for API key first
  if (!hasApiKey()) {
    return {
      content: [
        {
          type: "text",
          text:
            "SOVANT_API_KEY environment variable is not set.\n" +
            "Please set it in your shell or Claude Code configuration:\n" +
            "  export SOVANT_API_KEY=sk_live_your_key_here\n" +
            "Get your API key at https://sovant.ai/dashboard/settings/api-keys",
        },
      ],
      isError: true,
    };
  }

  // Initialize thread on first tool call if not already done
  if (!isSessionInitialized()) {
    try {
      const { summary, isNew } = await initializeThread();
      // Log the session summary (will be visible in Claude Code)
      console.error(
        `[sovant] ${isNew ? "Created new thread" : "Loaded thread"}`,
      );
      console.error(`[sovant] ${summary}`);
    } catch (error) {
      console.error("[sovant] Failed to initialize thread:", error);
    }
  }

  try {
    let result: string;

    switch (name) {
      case "sovant_remember":
        result = await handleRemember((args as any)?.text || "");
        break;

      case "sovant_remember_pref":
        result = await handleRememberPref((args as any)?.text || "");
        break;

      case "sovant_remember_decision":
        result = await handleRememberDecision((args as any)?.text || "");
        break;

      case "sovant_recall":
        result = await handleRecall(
          (args as any)?.query || "",
          (args as any)?.limit,
          (args as any)?.scope,
          (args as any)?.mode,
          (args as any)?.debug,
          (args as any)?.include_workspace,
        );
        break;

      case "sovant_search":
        result = await handleSearch({
          query: (args as any)?.query || "",
          scope: (args as any)?.scope,
          tags: (args as any)?.tags,
          type: (args as any)?.type,
          limit: (args as any)?.limit,
        });
        break;

      case "sovant_memory_list":
        result = await handleMemory(`list ${(args as any)?.count || ""}`);
        break;

      case "sovant_memory_delete":
        result = await handleMemory(`delete ${(args as any)?.memory_id || ""}`);
        break;

      case "sovant_memory_update":
        result = await handleMemoryUpdate(
          (args as any)?.memory_id || "",
          (args as any)?.text || "",
        );
        break;

      case "sovant_memory_show":
        result = await handleMemory(`show ${(args as any)?.memory_id || ""}`);
        break;

      case "sovant_thread_info": {
        const info = await getThreadInfo();
        result = [
          `**Project Thread Info** (${info.data_source})`,
          `Repo: ${info.repo}`,
          `Thread ID: ${info.thread_id}`,
          `Thread Title: ${info.thread_title}`,
          info.memory_count !== undefined
            ? `Memories: ${info.memory_count}`
            : null,
          info.created_at ? `Created: ${info.created_at}` : null,
          info.branch ? `Branch: ${info.branch}` : null,
          `Config File: ${info.config_path}`,
        ]
          .filter(Boolean)
          .join("\n");
        break;
      }

      default:
        result = `Unknown tool: ${name}`;
    }

    return {
      content: [
        {
          type: "text",
          text: result,
        },
      ],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return {
      content: [
        {
          type: "text",
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[sovant] MCP server started");
}

main().catch((error) => {
  console.error("[sovant] Fatal error:", error);
  process.exit(1);
});

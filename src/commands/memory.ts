/**
 * Memory management command handlers
 *
 * /memory list [n]    - List recent memories (default 20)
 * /memory delete <id> - Delete a memory by ID
 * /memory show <id>   - Show full memory details (optional)
 */

import { getSovantClient, formatSovantError } from "../sovant.js";
import { getThreadId } from "./shared.js";
import { formatMemoryList, shortId, truncate, formatDate } from "../format.js";

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

/**
 * Resolve a short ID (8+ chars) to a full UUID by searching recent memories.
 * If the input is already a full UUID (36 chars), returns it as-is.
 * Throws a user-friendly error if no match is found.
 */
async function resolveMemoryId(shortOrFullId: string): Promise<string> {
  if (shortOrFullId.length >= 36) {
    return shortOrFullId;
  }

  const client = getSovantClient();
  const threadId = await getThreadId();
  const listResult = await client.memory.list({
    thread_id: threadId,
    limit: 100,
  });

  const memories = listResult.memories || [];
  const match = memories.find((m: any) => m.id.startsWith(shortOrFullId));

  if (!match) {
    throw new Error(
      `No memory found with ID starting with "${shortOrFullId}".\nUse /memory list to see available memories.`,
    );
  }

  return match.id;
}

/**
 * Handle /memory list command
 */
export async function handleMemoryList(args: string): Promise<string> {
  try {
    const client = getSovantClient();
    const threadId = await getThreadId();

    // Parse optional count argument
    let limit = DEFAULT_LIST_LIMIT;
    const countArg = args.trim();
    if (countArg) {
      const parsed = parseInt(countArg, 10);
      if (isNaN(parsed) || parsed < 1) {
        return `Invalid count. Usage: /memory list [count]\nExample: /memory list 10`;
      }
      limit = Math.min(parsed, MAX_LIST_LIMIT);
    }

    const result = await client.memory.list({
      thread_id: threadId,
      limit,
      sort_by: "created_at",
      sort_order: "desc",
    });

    const memories = result.memories || [];
    const total = result.total || memories.length;

    return formatMemoryList(memories, total);
  } catch (error) {
    return `Failed to list memories: ${formatSovantError(error)}`;
  }
}

/**
 * Handle /memory delete command
 */
export async function handleMemoryDelete(memoryId: string): Promise<string> {
  const id = memoryId.trim();

  if (!id) {
    return "Please provide a memory ID. Usage: /memory delete <id>\nUse /memory list to see memory IDs.";
  }

  try {
    const client = getSovantClient();
    const fullId = await resolveMemoryId(id);

    await client.memory.delete(fullId);

    return `Deleted memory ${shortId(fullId)}`;
  } catch (error) {
    return `Failed to delete memory: ${formatSovantError(error)}`;
  }
}

/**
 * Handle /memory show command - show full memory details
 */
export async function handleMemoryShow(memoryId: string): Promise<string> {
  const id = memoryId.trim();

  if (!id) {
    return "Please provide a memory ID. Usage: /memory show <id>\nUse /memory list to see memory IDs.";
  }

  try {
    const client = getSovantClient();
    const fullId = await resolveMemoryId(id);

    const result = await client.memory.get(fullId);

    if (!result) {
      return `Memory ${shortId(fullId)} not found.`;
    }

    // Format full memory details
    const memory = result as any;
    const lines = [
      `**Memory ${shortId(memory.id)}**`,
      `Type: ${memory.type || "unknown"}`,
      `Created: ${formatDate(memory.created_at)}`,
      `Tags: ${(memory.tags || []).join(", ") || "none"}`,
      "",
      "**Content:**",
      memory.content || "(empty)",
    ];

    if (memory.metadata && Object.keys(memory.metadata).length > 0) {
      lines.push("");
      lines.push("**Metadata:**");
      lines.push(JSON.stringify(memory.metadata, null, 2));
    }

    return lines.join("\n");
  } catch (error) {
    return `Failed to get memory: ${formatSovantError(error)}`;
  }
}

/**
 * Handle memory update — replace a memory's content by ID
 */
export async function handleMemoryUpdate(
  memoryId: string,
  text: string,
): Promise<string> {
  const id = memoryId.trim();

  if (!id) {
    return "Please provide a memory ID. Usage: sovant_memory_update { memory_id, text }";
  }
  if (!text.trim()) {
    return "Please provide new text content.";
  }

  try {
    const client = getSovantClient();
    const fullId = await resolveMemoryId(id);

    await client.memory.update(fullId, { data: text.trim() });

    return `Updated memory ${shortId(fullId)}`;
  } catch (error) {
    return `Failed to update memory: ${formatSovantError(error)}`;
  }
}

/**
 * Route memory subcommands
 */
export async function handleMemory(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const subcommand = parts[0]?.toLowerCase();
  const subArgs = parts.slice(1).join(" ");

  switch (subcommand) {
    case "list":
      return handleMemoryList(subArgs);
    case "delete":
      return handleMemoryDelete(subArgs);
    case "show":
      return handleMemoryShow(subArgs);
    case "":
    case undefined:
      return (
        "Memory commands:\n" +
        "  /memory list [n]    - List recent memories (default 20)\n" +
        "  /memory delete <id> - Delete a memory by ID\n" +
        "  /memory show <id>   - Show full memory details"
      );
    default:
      return `Unknown subcommand: ${subcommand}\nUse /memory for available commands.`;
  }
}

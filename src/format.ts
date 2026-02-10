/**
 * Output formatting utilities for Claude Code MCP plugin
 *
 * Formats Sovant API responses into human-readable text
 * optimized for display in Claude Code.
 */

export interface MemoryItem {
  id: string;
  content: string;
  type: string;
  tags?: string[];
  created_at?: string;
  relevance?: number;
  importance_score?: number;
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed
 */
export function truncate(text: string, maxLength: number = 120): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Shorten a UUID for display (first 8 chars)
 */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

/**
 * Format a date for display
 */
export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "unknown";

  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a single memory for list display
 */
export function formatMemoryListItem(memory: MemoryItem): string {
  const id = shortId(memory.id);
  const type = memory.type || "unknown";
  const date = formatDate(memory.created_at);
  const content = truncate(memory.content.replace(/\n/g, " "));

  return `[${id}] ${type} (${date})\n  ${content}`;
}

/**
 * Format a single memory for recall display (with relevance)
 */
export function formatRecallItem(memory: MemoryItem, index: number): string {
  const id = shortId(memory.id);
  const type = memory.type || "unknown";
  const content = truncate(memory.content.replace(/\n/g, " "));
  const relevance = memory.relevance
    ? ` (${Math.round(memory.relevance * 100)}%)`
    : "";

  return `${index + 1}. [${id}] ${type}${relevance}\n   ${content}`;
}

/**
 * Format a list of memories for display
 */
export function formatMemoryList(
  memories: MemoryItem[],
  total?: number,
): string {
  if (memories.length === 0) {
    return "No memories found.";
  }

  const lines = memories.map((m) => formatMemoryListItem(m));
  const header =
    total !== undefined
      ? `Showing ${memories.length} of ${total} memories:\n`
      : `Found ${memories.length} memories:\n`;

  return header + lines.join("\n\n");
}

/**
 * Format recall results for display
 */
export function formatRecallResults(
  results: MemoryItem[],
  query: string,
): string {
  if (results.length === 0) {
    return `No relevant memories found for: "${query}"`;
  }

  const lines = results.map((m, i) => formatRecallItem(m, i));
  return `Found ${results.length} relevant memories:\n\n` + lines.join("\n\n");
}

/**
 * Format search results with explicit scope header
 *
 * When showRepo is true (global scope), prints the repo tag for each result.
 */
export function formatSearchResults(
  results: MemoryItem[],
  query: string,
  scopeHeader: string,
  showRepo: boolean,
): string {
  if (results.length === 0) {
    return `${scopeHeader}\n\nNo results found for: "${query}"`;
  }

  const lines = results.map((m, i) => {
    const base = formatRecallItem(m, i);
    if (showRepo) {
      const repoTag = (m.tags || []).find((t) => t.startsWith("repo:"));
      if (repoTag) {
        return `${base}\n   Repo: ${repoTag.replace("repo:", "")}`;
      }
    }
    return base;
  });

  return (
    `${scopeHeader}\n\nFound ${results.length} results:\n\n` +
    lines.join("\n\n")
  );
}

/**
 * Format session start summary grouped by type
 */
export function formatSessionSummary(memories: MemoryItem[]): string {
  if (memories.length === 0) {
    return "No project context loaded. Start saving memories with /remember.";
  }

  // Group by type/tag
  const groups: Record<string, MemoryItem[]> = {
    decisions: [],
    preferences: [],
    tasks: [],
    other: [],
  };

  for (const memory of memories) {
    const tags = memory.tags || [];
    const type = memory.type || "journal";

    if (tags.includes("decision") || type === "insight") {
      groups.decisions.push(memory);
    } else if (type === "preference" || tags.includes("preference")) {
      groups.preferences.push(memory);
    } else if (type === "task" || tags.includes("todo")) {
      groups.tasks.push(memory);
    } else {
      groups.other.push(memory);
    }
  }

  const sections: string[] = [];

  if (groups.decisions.length > 0) {
    sections.push(
      "**Decisions:**\n" +
        groups.decisions.map((m) => `- ${truncate(m.content, 100)}`).join("\n"),
    );
  }

  if (groups.preferences.length > 0) {
    sections.push(
      "**Preferences:**\n" +
        groups.preferences
          .map((m) => `- ${truncate(m.content, 100)}`)
          .join("\n"),
    );
  }

  if (groups.tasks.length > 0) {
    sections.push(
      "**Tasks/TODOs:**\n" +
        groups.tasks.map((m) => `- ${truncate(m.content, 100)}`).join("\n"),
    );
  }

  if (groups.other.length > 0) {
    sections.push(
      "**Other notes:**\n" +
        groups.other.map((m) => `- ${truncate(m.content, 100)}`).join("\n"),
    );
  }

  return (
    `Loaded ${memories.length} project memories:\n\n` + sections.join("\n\n")
  );
}

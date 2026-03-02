/**
 * Recall and search command handlers
 *
 * handleRecall  — thread-scoped hybrid recall (current repo only)
 * handleSearch  — explicit-scope search (repo default, global opt-in)
 */

import { getSovantClient, formatSovantError } from "../sovant.js";
import { getThreadId } from "./shared.js";
import { getRepoInfo } from "../repo.js";
import { formatRecallResults, formatSearchResults } from "../format.js";

const DEFAULT_RECALL_LIMIT = 10;
const MAX_RECALL_LIMIT = 25;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 20;

/**
 * Handle /recall command — hybrid recall with optional scope/mode/debug
 *
 * scope="thread" (default): filters by current repo thread_id
 * scope="global": omits thread_id for cross-project recall
 * mode="smart" (default): full hybrid pipeline (LLM interpreter + vector + lexical)
 * mode="exact": deterministic keyword-only recall
 * debug=true: appends source/type counts and token estimates
 * includeWorkspace=true: include non-dev memories (dashboard, CRM, smart capture)
 *   Default false — MCP recall is dev-only (source:claude-code tagged) by default
 */
export async function handleRecall(
  query: string,
  limit?: number,
  scope?: "thread" | "global",
  mode?: "smart" | "exact",
  debug?: boolean,
  includeWorkspace?: boolean,
): Promise<string> {
  if (!query.trim()) {
    return "Please provide a search query. Usage: /recall <question>";
  }

  const effectiveLimit = Math.min(
    limit ?? DEFAULT_RECALL_LIMIT,
    MAX_RECALL_LIMIT,
  );

  try {
    const client = getSovantClient();

    // Build recall params — omit thread_id for global scope
    // Default space=dev (only source:claude-code tagged memories)
    // unless includeWorkspace=true, then space=all
    const recallParams: any = {
      query: query.trim(),
      limit: effectiveLimit,
      space: includeWorkspace ? "all" : "dev",
    };

    if (scope !== "global") {
      recallParams.thread_id = await getThreadId();
    }
    if (mode) {
      recallParams.mode = mode;
    }

    const result = await client.memory.recall(recallParams);

    const results = (result as any)?.results || [];
    let output = formatRecallResults(results, query.trim());

    // Append debug block if requested
    if (debug) {
      const meta = (result as any)?.recall_metadata || {};
      const spaceUsed = includeWorkspace ? "all" : "dev";
      const bySource: Record<string, number> = {};
      const byType: Record<string, number> = {};
      for (const r of results) {
        bySource[r.source || "unknown"] =
          (bySource[r.source || "unknown"] || 0) + 1;
        byType[r.type || "unknown"] = (byType[r.type || "unknown"] || 0) + 1;
      }
      output += `\n---\nDebug: scope=${scope || "thread"} mode=${mode || "smart"} space=${spaceUsed} returned=${results.length} pinned=${meta.pinned_count ?? 0} est_tokens=${meta.estimated_tokens ?? "?"} omitted=${meta.omitted_by_budget ?? 0} truncated=${meta.truncated ?? false}\n  bySource: ${JSON.stringify(bySource)}\n  byType: ${JSON.stringify(byType)}`;
    }

    return output;
  } catch (error) {
    return `Recall failed: ${formatSovantError(error)}`;
  }
}

/**
 * Handle search command — explicit-scope memory search
 *
 * scope="repo" (default): filters by repo tag and/or thread_id
 * scope="global": no repo or thread filtering
 */
export async function handleSearch(params: {
  query: string;
  scope?: "repo" | "global";
  tags?: string;
  type?: string;
  limit?: number;
}): Promise<string> {
  const query = params.query?.trim();
  if (!query) {
    return "Please provide a search query.";
  }

  const scope = params.scope || "repo";
  const effectiveLimit = Math.min(
    params.limit ?? DEFAULT_SEARCH_LIMIT,
    MAX_SEARCH_LIMIT,
  );

  try {
    const client = getSovantClient();
    const repoInfo = getRepoInfo();

    // Build search parameters based on scope
    const searchParams: {
      query: string;
      type?: string;
      tags?: string[];
      thread_id?: string;
      limit?: number;
    } = {
      query,
      limit: effectiveLimit,
    };

    // Parse user-provided tags
    const userTags: string[] = params.tags
      ? params.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    if (scope === "repo") {
      // Safe-by-default: scope to current repo
      const threadId = await getThreadId();
      searchParams.thread_id = threadId;
      if (repoInfo.repo) {
        userTags.push(`repo:${repoInfo.repo}`);
      }
    }
    // scope="global": no thread_id, no repo tag — intentionally wide

    if (userTags.length > 0) {
      searchParams.tags = userTags;
    }
    if (params.type) {
      searchParams.type = params.type;
    }

    const result = await client.memory.search(searchParams);
    const results = (result as any)?.results || (result as any)?.memories || [];

    // Build scope header
    const scopeHeader =
      scope === "repo"
        ? `Scope: REPO (${repoInfo.repo})`
        : `Scope: GLOBAL (all projects)`;

    return formatSearchResults(results, query, scopeHeader, scope === "global");
  } catch (error) {
    return `Search failed: ${formatSovantError(error)}`;
  }
}

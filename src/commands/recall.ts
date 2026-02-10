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
 * Handle /recall command — thread-scoped hybrid recall
 */
export async function handleRecall(
  query: string,
  limit?: number,
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
    const threadId = await getThreadId();

    const result = await client.memory.recall({
      query: query.trim(),
      thread_id: threadId,
      limit: effectiveLimit,
    });

    const results = (result as any)?.results || [];

    return formatRecallResults(results, query.trim());
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

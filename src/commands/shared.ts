/**
 * Shared utilities for command handlers
 *
 * Manages thread initialization and caching across commands.
 */

import { getSovantClient, formatSovantError } from "../sovant.js";
import { getRepoInfo, type RepoInfo } from "../repo.js";
import {
  loadThreadConfig,
  saveThreadConfig,
  canWriteConfig,
  getConfigPath,
  type ThreadConfig,
} from "../localStore.js";
import { formatSessionSummary } from "../format.js";

/**
 * Build standard tags for all memories
 *
 * Returns tags: source:claude-code, repo:<org/name>, and optionally branch:<branch>
 */
export function buildMemoryTags(repoInfo?: RepoInfo): string[] {
  const info = repoInfo || getRepoInfo();
  const tags: string[] = ["source:claude-code"];

  // Always add repo tag
  if (info.repo) {
    tags.push(`repo:${info.repo}`);
  }

  // Add branch tag if available
  if (info.branch) {
    tags.push(`branch:${info.branch}`);
  }

  return tags;
}

/** Cached thread ID for the current session */
let cachedThreadId: string | null = null;

/** Whether we've run session initialization */
let sessionInitialized = false;

/**
 * Initialize the thread for this repo
 *
 * 1. Try to load from .sovant/thread.json
 * 2. If not found, create a new Sovant thread
 * 3. Save the config if possible
 * 4. Run session-start recall
 */
export async function initializeThread(): Promise<{
  threadId: string;
  summary: string;
  isNew: boolean;
}> {
  const repoInfo = getRepoInfo();
  const client = getSovantClient();

  // Try to load existing config
  let config = loadThreadConfig();

  if (config && config.repo === repoInfo.repo) {
    // Existing thread for this repo
    cachedThreadId = config.thread_id;

    // Update last_seen
    config.last_seen = new Date().toISOString();
    saveThreadConfig(config);

    // Run session-start recall
    const summary = await runSessionRecall(config.thread_id);

    sessionInitialized = true;
    return {
      threadId: config.thread_id,
      summary,
      isNew: false,
    };
  }

  // Create new thread
  try {
    const createdAt = new Date().toISOString();
    const result = await client.threads.create({
      title: repoInfo.repo,
      description: `Project memory for ${repoInfo.repo}`,
      metadata: {
        source: "claude-code",
        repo: repoInfo.repo,
        branch: repoInfo.branch,
        created_at: createdAt,
      },
    });

    const threadId = result.id;
    cachedThreadId = threadId;

    // Save config
    const newConfig: ThreadConfig = {
      thread_id: threadId,
      repo: repoInfo.repo,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };

    const saved = saveThreadConfig(newConfig);
    if (!saved && canWriteConfig()) {
      console.warn("[sovant] Could not persist thread config to disk");
    }

    sessionInitialized = true;
    return {
      threadId,
      summary: `Created new project thread for ${repoInfo.repo}. Start saving memories with /remember.`,
      isNew: true,
    };
  } catch (error) {
    throw new Error(`Failed to create thread: ${formatSovantError(error)}`);
  }
}

/**
 * Get the thread ID for the current repo
 * Initializes if not already done
 */
export async function getThreadId(): Promise<string> {
  if (cachedThreadId) {
    return cachedThreadId;
  }

  const { threadId } = await initializeThread();
  return threadId;
}

/**
 * Check if session has been initialized
 */
export function isSessionInitialized(): boolean {
  return sessionInitialized;
}

/**
 * Run session-start recall and format summary
 */
async function runSessionRecall(threadId: string): Promise<string> {
  try {
    const client = getSovantClient();

    // Recall important project context
    const result = await client.memory.recall({
      query:
        "Summarize the most important decisions, constraints, preferences, and open TODOs for this project.",
      thread_id: threadId,
      limit: 8,
    });

    const results = (result as any)?.results || [];

    return formatSessionSummary(results);
  } catch (error) {
    console.error("[sovant] Session recall failed:", error);
    return "Could not load project context. Memories are still accessible via /recall.";
  }
}

/**
 * Get session summary (for explicit /status command if needed)
 */
export async function getSessionSummary(): Promise<string> {
  const threadId = await getThreadId();
  return runSessionRecall(threadId);
}

/**
 * Get thread info for the current repo
 *
 * Fetches live data from the API (thread title, memory count, created_at).
 * Falls back to local-only data if the API call fails.
 * Output includes a (live) or (local fallback) indicator.
 */
export async function getThreadInfo(): Promise<{
  repo: string;
  thread_id: string;
  thread_title: string;
  memory_count?: number;
  created_at?: string;
  config_path: string;
  branch?: string;
  data_source: "live" | "local fallback";
}> {
  const repoInfo = getRepoInfo();
  const threadId = await getThreadId();
  const configPath = getConfigPath();

  // Try to fetch live thread data from the API
  try {
    const client = getSovantClient();
    const result = await client.threads.get(threadId, {
      include_memories: false,
    });
    const thread = result.thread;

    return {
      repo: repoInfo.repo,
      thread_id: threadId,
      thread_title: thread.title || repoInfo.repo,
      memory_count: thread.memory_ids?.length,
      created_at: thread.created_at,
      config_path: configPath,
      branch: repoInfo.branch,
      data_source: "live",
    };
  } catch {
    // API unavailable — return local-only data
    return {
      repo: repoInfo.repo,
      thread_id: threadId,
      thread_title: repoInfo.repo,
      config_path: configPath,
      branch: repoInfo.branch,
      data_source: "local fallback",
    };
  }
}

/**
 * Remember command handlers
 *
 * /remember <text>          - Save as journal entry
 * /remember-pref <text>     - Save as preference
 * /remember-decision <text> - Save as decision/insight
 */

import { getSovantClient, formatSovantError } from "../sovant.js";
import { getThreadId, buildMemoryTags } from "./shared.js";
import { getRepoInfo } from "../repo.js";
import { shortId } from "../format.js";

/** Memory types for each command variant */
type MemoryVariant = "journal" | "preference" | "decision";

interface RememberResult {
  success: boolean;
  message: string;
  memoryId?: string;
}

/**
 * Create a memory with the appropriate type and tags
 */
async function createMemory(
  content: string,
  variant: MemoryVariant,
): Promise<RememberResult> {
  try {
    const client = getSovantClient();
    const threadId = await getThreadId();
    const repoInfo = getRepoInfo();

    // Determine type and build tags using shared helper
    let type: "journal" | "preference" | "insight";
    const tags = buildMemoryTags(repoInfo);
    tags.push("user-saved"); // All explicit saves are user-saved

    switch (variant) {
      case "journal":
        type = "journal";
        break;
      case "preference":
        type = "preference";
        tags.push("preference");
        break;
      case "decision":
        type = "insight";
        tags.push("decision");
        break;
    }

    // Build metadata
    const metadata = {
      source: "claude-code",
      repo: repoInfo.repo,
      branch: repoInfo.branch,
      user_confirmed: true,
      confidence: 1.0,
    };

    // Create the memory
    const result = await client.memory.create({
      data: content,
      type,
      tags,
      metadata,
      thread_id: threadId,
    });

    const id = (result as any)?.id;
    if (!id) {
      return {
        success: false,
        message: "Memory created but no ID returned",
      };
    }

    return {
      success: true,
      message: `Saved memory ${shortId(id)}`,
      memoryId: id,
    };
  } catch (error) {
    return {
      success: false,
      message: formatSovantError(error),
    };
  }
}

/**
 * Handle /remember command - saves as journal entry
 */
export async function handleRemember(text: string): Promise<string> {
  if (!text.trim()) {
    return "Please provide text to remember. Usage: /remember <text>";
  }

  const result = await createMemory(text.trim(), "journal");
  return result.message;
}

/**
 * Handle /remember-pref command - saves as preference
 */
export async function handleRememberPref(text: string): Promise<string> {
  if (!text.trim()) {
    return "Please provide a preference to remember. Usage: /remember-pref <preference>";
  }

  const result = await createMemory(text.trim(), "preference");
  return result.message;
}

/**
 * Handle /remember-decision command - saves as decision/insight
 */
export async function handleRememberDecision(text: string): Promise<string> {
  if (!text.trim()) {
    return "Please provide a decision to remember. Usage: /remember-decision <decision>";
  }

  const result = await createMemory(text.trim(), "decision");
  return result.message;
}

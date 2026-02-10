/**
 * Git repository detection helpers
 *
 * Detects the current git repository and extracts identifying information
 * like owner/repo name and current branch.
 */

import { execSync } from "child_process";
import { basename } from "path";

export interface RepoInfo {
  /** Repository identifier (owner/repo or folder name) */
  repo: string;
  /** Current git branch (if available) */
  branch?: string;
  /** Whether this is a git repository */
  isGitRepo: boolean;
}

/**
 * Get repository information for the current working directory
 */
export function getRepoInfo(): RepoInfo {
  const cwd = process.cwd();

  // Try to detect git repo
  try {
    // Check if we're in a git repo
    execSync("git rev-parse --git-dir", { cwd, stdio: "pipe" });
  } catch {
    // Not a git repo, use folder name
    return {
      repo: basename(cwd),
      isGitRepo: false,
    };
  }

  // Get remote URL and extract owner/repo
  let repo: string;
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();

    repo = normalizeRemoteUrl(remoteUrl);
  } catch {
    // No remote, use folder name
    repo = basename(cwd);
  }

  // Get current branch
  let branch: string | undefined;
  try {
    branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
    }).trim();
  } catch {
    // Ignore branch detection errors
  }

  return {
    repo,
    branch,
    isGitRepo: true,
  };
}

/**
 * Normalize a git remote URL to owner/repo format
 *
 * Handles:
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 * - https://gitlab.com/owner/repo
 * - etc.
 */
function normalizeRemoteUrl(url: string): string {
  // Remove .git suffix
  url = url.replace(/\.git$/, "");

  // Handle SSH URLs (git@github.com:owner/repo)
  const sshMatch = url.match(/^git@[^:]+:(.+)$/);
  if (sshMatch) {
    return sshMatch[1];
  }

  // Handle HTTPS URLs (https://github.com/owner/repo)
  try {
    const parsed = new URL(url);
    // Remove leading slash and return path
    return parsed.pathname.replace(/^\//, "");
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Get a short identifier for the repo (last component)
 */
export function getRepoShortName(repo: string): string {
  const parts = repo.split("/");
  return parts[parts.length - 1];
}

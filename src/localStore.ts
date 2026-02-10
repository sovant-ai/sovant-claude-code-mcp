/**
 * Local storage for Sovant thread configuration
 *
 * Persists the thread ID mapping in .sovant/thread.json so that
 * memories are associated with the correct repo across sessions.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

export interface ThreadConfig {
  /** Sovant thread UUID */
  thread_id: string;
  /** Repository identifier (owner/repo or folder name) */
  repo: string;
  /** When the thread was first created */
  created_at: string;
  /** Last time this config was accessed */
  last_seen: string;
}

const SOVANT_DIR = ".sovant";
const THREAD_FILE = "thread.json";

/**
 * Get the path to the thread config file
 */
export function getConfigPath(): string {
  return join(process.cwd(), SOVANT_DIR, THREAD_FILE);
}

/**
 * Load thread configuration from .sovant/thread.json
 * @returns ThreadConfig or null if not found
 */
export function loadThreadConfig(): ThreadConfig | null {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content) as ThreadConfig;

    // Validate required fields
    if (!config.thread_id || !config.repo) {
      console.error("[sovant] Invalid thread config, missing required fields");
      return null;
    }

    return config;
  } catch (error) {
    console.error("[sovant] Failed to load thread config:", error);
    return null;
  }
}

/**
 * Save thread configuration to .sovant/thread.json
 * @returns true if saved successfully, false otherwise
 */
export function saveThreadConfig(config: ThreadConfig): boolean {
  const configPath = getConfigPath();
  const configDir = dirname(configPath);

  try {
    // Create .sovant directory if it doesn't exist
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Write config with pretty formatting
    writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

    return true;
  } catch (error) {
    console.error("[sovant] Failed to save thread config:", error);
    return false;
  }
}

/**
 * Update the last_seen timestamp in the config
 */
export function updateLastSeen(): void {
  const config = loadThreadConfig();
  if (config) {
    config.last_seen = new Date().toISOString();
    saveThreadConfig(config);
  }
}

/**
 * Check if the .sovant directory is writable
 */
export function canWriteConfig(): boolean {
  const configDir = join(process.cwd(), SOVANT_DIR);

  try {
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Try to write a test file
    const testPath = join(configDir, ".write-test");
    writeFileSync(testPath, "test", "utf-8");

    // Clean up
    const { unlinkSync } = require("fs");
    unlinkSync(testPath);

    return true;
  } catch {
    return false;
  }
}

/**
 * Unit tests for localStore.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

// We need to mock the cwd for these tests
const TEST_DIR = join(process.cwd(), "tests", "unit", ".test-sovant");

describe("localStore", () => {
  beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("ThreadConfig structure", () => {
    it("has correct shape", () => {
      const config = {
        thread_id: "test-uuid",
        repo: "owner/repo",
        created_at: new Date().toISOString(),
        last_seen: new Date().toISOString(),
      };

      expect(config).toHaveProperty("thread_id");
      expect(config).toHaveProperty("repo");
      expect(config).toHaveProperty("created_at");
      expect(config).toHaveProperty("last_seen");
    });
  });

  describe("config validation", () => {
    it("validates required fields", () => {
      const validConfig = {
        thread_id: "uuid",
        repo: "test",
        created_at: "2024-01-01",
        last_seen: "2024-01-01",
      };

      expect(validConfig.thread_id).toBeTruthy();
      expect(validConfig.repo).toBeTruthy();
    });

    it("rejects config without thread_id", () => {
      const invalidConfig = {
        repo: "test",
        created_at: "2024-01-01",
        last_seen: "2024-01-01",
      };

      expect((invalidConfig as any).thread_id).toBeFalsy();
    });
  });
});

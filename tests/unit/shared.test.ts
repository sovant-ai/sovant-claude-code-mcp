/**
 * Unit tests for commands/shared.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildMemoryTags } from "../../src/commands/shared.js";
import type { RepoInfo } from "../../src/repo.js";

// Mock getRepoInfo for tests that don't pass repoInfo
vi.mock("../../src/repo.js", () => ({
  getRepoInfo: () => ({
    repo: "owner/test-repo",
    branch: "main",
    isGitRepo: true,
  }),
}));

describe("buildMemoryTags", () => {
  it("includes source:claude-code tag", () => {
    const repoInfo: RepoInfo = {
      repo: "owner/repo",
      branch: "main",
      isGitRepo: true,
    };

    const tags = buildMemoryTags(repoInfo);

    expect(tags).toContain("source:claude-code");
  });

  it("includes repo tag with owner/name", () => {
    const repoInfo: RepoInfo = {
      repo: "henrychin/sovant-ai",
      branch: "main",
      isGitRepo: true,
    };

    const tags = buildMemoryTags(repoInfo);

    expect(tags).toContain("repo:henrychin/sovant-ai");
  });

  it("includes branch tag when branch is available", () => {
    const repoInfo: RepoInfo = {
      repo: "owner/repo",
      branch: "feature/new-feature",
      isGitRepo: true,
    };

    const tags = buildMemoryTags(repoInfo);

    expect(tags).toContain("branch:feature/new-feature");
  });

  it("excludes branch tag when branch is undefined", () => {
    const repoInfo: RepoInfo = {
      repo: "owner/repo",
      isGitRepo: true,
    };

    const tags = buildMemoryTags(repoInfo);

    expect(tags).not.toContain("branch:undefined");
    expect(tags.some((t) => t.startsWith("branch:"))).toBe(false);
  });

  it("uses getRepoInfo when no repoInfo provided", () => {
    const tags = buildMemoryTags();

    expect(tags).toContain("source:claude-code");
    expect(tags).toContain("repo:owner/test-repo");
    expect(tags).toContain("branch:main");
  });

  it("handles non-git repos (folder name)", () => {
    const repoInfo: RepoInfo = {
      repo: "my-project",
      isGitRepo: false,
    };

    const tags = buildMemoryTags(repoInfo);

    expect(tags).toContain("source:claude-code");
    expect(tags).toContain("repo:my-project");
  });
});

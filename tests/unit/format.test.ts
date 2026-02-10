/**
 * Unit tests for format.ts
 */

import { describe, it, expect } from "vitest";
import {
  truncate,
  shortId,
  formatDate,
  formatMemoryListItem,
  formatRecallItem,
  formatMemoryList,
  formatRecallResults,
  formatSessionSummary,
} from "../../src/format.js";

describe("truncate", () => {
  it("returns short text unchanged", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long text with ellipsis", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  it("uses default max length of 120", () => {
    const longText = "a".repeat(150);
    const result = truncate(longText);
    expect(result.length).toBe(120);
    expect(result.endsWith("...")).toBe(true);
  });
});

describe("shortId", () => {
  it("returns first 8 characters", () => {
    expect(shortId("12345678-abcd-efgh-ijkl")).toBe("12345678");
  });

  it("handles short IDs", () => {
    expect(shortId("abc")).toBe("abc");
  });
});

describe("formatDate", () => {
  it("formats ISO date string", () => {
    const result = formatDate("2024-01-15T10:30:00Z");
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });

  it("returns 'unknown' for undefined", () => {
    expect(formatDate(undefined)).toBe("unknown");
  });

  it("handles invalid date gracefully", () => {
    // Invalid dates still produce a result (JavaScript Date behavior)
    const result = formatDate("not-a-date");
    expect(typeof result).toBe("string");
  });
});

describe("formatMemoryListItem", () => {
  it("formats memory with all fields", () => {
    const memory = {
      id: "12345678-abcd-efgh-ijkl",
      content: "Test memory content",
      type: "journal",
      created_at: "2024-01-15T10:30:00Z",
    };

    const result = formatMemoryListItem(memory);

    expect(result).toContain("[12345678]");
    expect(result).toContain("journal");
    expect(result).toContain("Test memory content");
  });

  it("handles missing fields", () => {
    const memory = {
      id: "12345678",
      content: "Test",
      type: "",
    };

    const result = formatMemoryListItem(memory);
    expect(result).toContain("unknown");
  });
});

describe("formatRecallItem", () => {
  it("includes relevance score when present", () => {
    const memory = {
      id: "12345678-abcd",
      content: "Test memory",
      type: "journal",
      relevance: 0.85,
    };

    const result = formatRecallItem(memory, 0);

    expect(result).toContain("1.");
    expect(result).toContain("85%");
  });

  it("omits relevance when not present", () => {
    const memory = {
      id: "12345678-abcd",
      content: "Test memory",
      type: "journal",
    };

    const result = formatRecallItem(memory, 0);

    expect(result).not.toContain("%");
  });
});

describe("formatMemoryList", () => {
  it("shows message for empty list", () => {
    const result = formatMemoryList([]);
    expect(result).toBe("No memories found.");
  });

  it("includes count header", () => {
    const memories = [
      { id: "1", content: "Test 1", type: "journal" },
      { id: "2", content: "Test 2", type: "journal" },
    ];

    const result = formatMemoryList(memories, 10);

    expect(result).toContain("Showing 2 of 10 memories");
  });
});

describe("formatRecallResults", () => {
  it("shows message for empty results", () => {
    const result = formatRecallResults([], "test query");
    expect(result).toContain("No relevant memories found");
    expect(result).toContain("test query");
  });

  it("formats results with count", () => {
    const results = [{ id: "1", content: "Test 1", type: "journal" }];

    const result = formatRecallResults(results, "query");
    expect(result).toContain("Found 1 relevant memories");
  });
});

describe("formatSessionSummary", () => {
  it("shows message for empty memories", () => {
    const result = formatSessionSummary([]);
    expect(result).toContain("No project context loaded");
  });

  it("groups by type", () => {
    const memories = [
      { id: "1", content: "Use TypeScript", type: "preference", tags: [] },
      { id: "2", content: "Chose React", type: "insight", tags: ["decision"] },
      { id: "3", content: "General note", type: "journal", tags: [] },
    ];

    const result = formatSessionSummary(memories);

    expect(result).toContain("**Preferences:**");
    expect(result).toContain("**Decisions:**");
    expect(result).toContain("**Other notes:**");
  });
});

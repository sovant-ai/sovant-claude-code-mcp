#!/usr/bin/env node
/**
 * Smoke test for Sovant Claude Code MCP plugin
 *
 * Tests the core functionality:
 * 1. Thread creation/loading
 * 2. Memory creation
 * 3. Memory listing
 * 4. Memory recall
 * 5. Memory deletion
 *
 * Requires SOVANT_API_KEY environment variable.
 */

import { Sovant } from "@sovant/sdk";

const API_KEY = process.env.SOVANT_API_KEY;

if (!API_KEY) {
  console.error("Error: SOVANT_API_KEY environment variable is not set");
  console.error("Usage: SOVANT_API_KEY=sk_live_... node smoke.mjs");
  process.exit(1);
}

const client = new Sovant({ apiKey: API_KEY });

// Test repo identifier
const TEST_REPO = `smoke-test-${Date.now()}`;

async function run() {
  console.log("=== Sovant Claude Code MCP Smoke Test ===\n");

  let threadId;
  let memoryId;

  try {
    // 1. Create thread
    console.log("1. Creating thread...");
    const thread = await client.threads.create({
      title: TEST_REPO,
      description: `Smoke test thread for ${TEST_REPO}`,
      metadata: {
        source: "claude-code",
        repo: TEST_REPO,
        test: true,
      },
    });
    threadId = thread.id;
    console.log(`   Created thread: ${threadId}\n`);

    // 2. Create memory
    console.log("2. Creating memory...");
    const memory = await client.memory.create({
      data: "This is a smoke test memory for the Claude Code MCP plugin.",
      type: "journal",
      tags: ["source:claude-code", "user-saved", "smoke-test"],
      metadata: {
        source: "claude-code",
        repo: TEST_REPO,
        user_confirmed: true,
        confidence: 1.0,
      },
      thread_id: threadId,
    });
    memoryId = memory.id;
    console.log(`   Created memory: ${memoryId}\n`);

    // 3. List memories
    console.log("3. Listing memories...");
    const listResult = await client.memory.list({
      thread_id: threadId,
      limit: 10,
    });
    console.log(`   Found ${listResult.memories.length} memories`);
    console.log(`   Total: ${listResult.total}\n`);

    // 4. Recall memories
    console.log("4. Recalling memories...");
    const recallResult = await client.memory.recall({
      query: "smoke test memory",
      thread_id: threadId,
      limit: 5,
    });
    const results = recallResult.results || [];
    console.log(`   Found ${results.length} relevant memories\n`);

    // 5. Delete memory
    console.log("5. Deleting memory...");
    await client.memory.delete(memoryId);
    console.log(`   Deleted memory: ${memoryId}\n`);

    // 6. Delete thread
    console.log("6. Deleting thread...");
    await client.threads.delete(threadId, true);
    console.log(`   Deleted thread: ${threadId}\n`);

    console.log("=== All tests passed! ===");
    process.exit(0);
  } catch (error) {
    console.error("\nTest failed:", error.message);
    console.error("Details:", error);

    // Cleanup on failure
    if (memoryId) {
      try {
        await client.memory.delete(memoryId);
        console.log("Cleaned up memory");
      } catch {
        // Ignore cleanup errors
      }
    }
    if (threadId) {
      try {
        await client.threads.delete(threadId, true);
        console.log("Cleaned up thread");
      } catch {
        // Ignore cleanup errors
      }
    }

    process.exit(1);
  }
}

run();

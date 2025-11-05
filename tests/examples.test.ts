/**
 * Integration tests for sessh examples (requires real infrastructure).
 * 
 * These tests are skipped by default. Enable with SESSH_INTEGRATION_TESTS=1
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { SesshClient } from "../src/index.js";

const INTEGRATION_TESTS_ENABLED = process.env.SESSH_INTEGRATION_TESTS === "1";

test("Local Example Integration - basic operations", async () => {
  if (!INTEGRATION_TESTS_ENABLED) {
    console.log("Skipping integration test. Set SESSH_INTEGRATION_TESTS=1 to run.");
    return;
  }

  const host = process.env.SESSH_TEST_HOST || "localhost";
  const user = process.env.USER || process.env.USERNAME || "user";

  const client = new SesshClient({
    alias: "test-local",
    host: `${user}@${host}`,
  });

  try {
    await client.open();

    // Run commands
    await client.run("echo 'Hello from integration test!'");
    await client.run("pwd");

    // Get logs
    const logs = await client.logs(50);
    assert.ok(logs.output?.toLowerCase().includes("integration test"));

    // Check status
    const status = await client.status();
    assert.strictEqual(status.master, 1);
    assert.strictEqual(status.session, 1);
  } finally {
    await client.close();
  }
});


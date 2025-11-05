/**
 * Tests for sessh TypeScript SDK (requires sessh binary and SSH setup).
 * 
 * Note: Actual integration tests require:
 * - sessh binary on PATH
 * - Valid SSH host
 * - SSH keys configured
 * These would be run in the Docker integration test suite
 */

import { SesshClient } from "../src/index.js";

// Basic smoke test
const client = new SesshClient({
  alias: "test",
  host: "user@example.com",
});

if (client) {
  console.log("✓ SesshClient can be instantiated");
} else {
  console.error("✗ SesshClient instantiation failed");
  process.exit(1);
}


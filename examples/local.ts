#!/usr/bin/env node
/** Example: Using sessh with a localhost or local VM. */
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { SesshClient } from "../src/index.js";

const exec = promisify(spawn);

async function main() {
  const host = process.argv[2] || "localhost";
  const user = process.env.USER || process.env.USERNAME || "user";
  const alias = "local-test";

  console.log(`=== Local Sessh Example ===`);
  console.log(`Host: ${user}@${host}`);
  console.log();

  const client = new SesshClient({
    alias,
    host: `${user}@${host}`,
  });

  try {
    // Open session
    console.log("Opening sessh session...");
    await client.open();

    // Run commands
    console.log("Running commands...");
    await client.run("echo 'Hello from sessh!'");
    await client.run("pwd");
    await client.run("whoami");
    await client.run("cd /tmp && pwd && echo 'State persisted!'");

    // Get logs
    console.log();
    console.log("=== Session Logs ===");
    const logs = await client.logs(50);
    console.log(logs.output || "");

    // Check status
    console.log();
    console.log("=== Session Status ===");
    const status = await client.status();
    console.log(`Master: ${status.master}, Session: ${status.session}`);

    console.log();
    console.log("Example completed successfully!");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});


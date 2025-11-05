#!/usr/bin/env node
/** Example: Using sessh with Docker Compose. */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SesshClient } from "../src/index.js";

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const composeFile = process.env.COMPOSE_FILE || "docker-compose.yml";
  const serviceName = process.env.SERVICE_NAME || "test-service";
  const alias = "compose-test";
  const sshPort = process.env.SSH_PORT || "2222";

  console.log(`=== Docker Compose Sessh Example ===`);
  console.log(`Service: ${serviceName}`);
  console.log();

  // Check if Docker Compose is available
  try {
    await execAsync("docker-compose --version");
  } catch {
    console.error("Error: docker-compose is required but not installed.");
    process.exit(1);
  }

  // Generate SSH key if needed
  const sshKeyPath = join(homedir(), ".ssh", "id_ed25519");
  if (!existsSync(sshKeyPath)) {
    console.log("Generating SSH key...");
    await execAsync(`ssh-keygen -t ed25519 -f ${sshKeyPath} -N "" -q`);
  }

  // Read public key
  const sshPubkey = readFileSync(`${sshKeyPath}.pub`, "utf-8").trim();

  // Create docker-compose.yml
  const composeContent = `version: '3.8'
services:
  ${serviceName}:
    image: ubuntu:22.04
    ports:
      - "${sshPort}:22"
    environment:
      - SSH_PUBKEY=${sshPubkey}
    command: >
      bash -c "
        apt-get update -qq &&
        apt-get install -y -qq openssh-server tmux sudo &&
        mkdir -p /var/run/sshd &&
        echo 'root:testpass' | chpasswd &&
        sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config &&
        mkdir -p /root/.ssh &&
        echo \"\\${SSH_PUBKEY}\" > /root/.ssh/authorized_keys &&
        chmod 700 /root/.ssh &&
        chmod 600 /root/.ssh/authorized_keys &&
        /usr/sbin/sshd -D
      "
`;

  const cleanupFile = !existsSync(composeFile);

  try {
    writeFileSync(composeFile, composeContent);

    // Start services
    console.log("Starting Docker Compose services...");
    await execAsync(`docker-compose -f ${composeFile} up -d`);

    // Wait for SSH to be ready
    console.log("Waiting for SSH server to be ready...");
    for (let i = 0; i < 30; i++) {
      try {
        await execAsync(
          `ssh -o ConnectTimeout=2 -o StrictHostKeyChecking=no -p ${sshPort} root@localhost echo ready`
        );
        break;
      } catch {
        await sleep(2000);
      }
    }

    // Get container info
    const containerResult = await execAsync(
      `docker-compose -f ${composeFile} ps -q ${serviceName}`
    );
    const containerId = containerResult.stdout.trim();
    console.log(`Container ID: ${containerId}`);

    // Create client
    const client = new SesshClient({
      alias,
      host: "root@localhost",
      port: parseInt(sshPort),
      identity: sshKeyPath,
    });

    try {
      // Open session
      console.log("Opening sessh session...");
      await client.open();

      // Run commands
      console.log("Running commands...");
      await client.run("echo 'Hello from Docker Compose service!'");
      await client.run("hostname");
      await client.run("apt-get update -qq");
      await client.run("which tmux");
      await client.run("cd /tmp && pwd && echo 'State persisted across commands!'");

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

      // Show Docker Compose status
      console.log();
      console.log("=== Docker Compose Status ===");
      await execAsync(`docker-compose -f ${composeFile} ps`);

      console.log();
      console.log("Example completed successfully!");
    } finally {
      await client.close();
    }
  } finally {
    // Cleanup
    console.log("Cleaning up...");
    try {
      await execAsync(`docker-compose -f ${composeFile} down`);
    } catch {
      // Ignore cleanup errors
    }
    if (cleanupFile && existsSync(composeFile)) {
      unlinkSync(composeFile);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});


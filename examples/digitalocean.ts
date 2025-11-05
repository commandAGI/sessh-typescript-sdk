#!/usr/bin/env node
/** Example: Using sessh with DigitalOcean Droplets. */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SesshClient } from "../src/index.js";

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const token = process.env.DO_TOKEN || "";
  const region = process.env.DO_REGION || "nyc1";
  const size = process.env.DO_SIZE || "s-1vcpu-1gb";
  const image = process.env.DO_IMAGE || "ubuntu-22-04-x64";
  const dropletName = `sessh-example-${Date.now()}`;
  const alias = "do-agent";

  console.log(`=== DigitalOcean Droplet Sessh Example ===`);
  console.log(`Region: ${region}`);
  console.log(`Size: ${size}`);
  console.log(`Image: ${image}`);
  console.log();

  // Check prerequisites
  try {
    await execAsync("doctl --version");
  } catch {
    console.error("Error: doctl CLI is required but not installed.");
    process.exit(1);
  }

  if (!token) {
    console.error("Error: DO_TOKEN environment variable must be set with your DigitalOcean API token.");
    process.exit(1);
  }

  // Authenticate doctl
  await execAsync(`doctl auth init --access-token ${token}`).catch(() => {});

  // Generate SSH key if needed
  const sshKeyPath = join(homedir(), ".ssh", "id_ed25519");
  if (!existsSync(sshKeyPath)) {
    console.log("Generating SSH key...");
    await execAsync(`ssh-keygen -t ed25519 -f ${sshKeyPath} -N "" -q`);
  }

  // Get SSH key fingerprint
  const fingerprintResult = await execAsync(
    `ssh-keygen -l -f ${sshKeyPath}.pub -E md5`
  );
  const fingerprint = fingerprintResult.stdout.split(" ")[1].replace("MD5:", "");

  // Add SSH key to DigitalOcean if not already present
  const sshKeyName = "sessh-key";
  const existingKeys = await execAsync(
    `doctl compute ssh-key list --format ID,Fingerprint --no-header`
  ).catch(() => ({ stdout: "" }));
  if (!existingKeys.stdout.includes(fingerprint)) {
    console.log("Adding SSH key to DigitalOcean...");
    await execAsync(
      `doctl compute ssh-key create ${sshKeyName} --public-key-file ${sshKeyPath}.pub`
    ).catch(() => {});
  }

  let dropletId: string | undefined;
  let ip: string | undefined;

  try {
    // Launch droplet
    console.log("Creating DigitalOcean droplet...");
    const result = await execAsync(
      `doctl compute droplet create ${dropletName} --region ${region} --size ${size} --image ${image} --ssh-keys ${fingerprint} --format ID,PublicIPv4 --no-header`
    );
    dropletId = result.stdout.split(" ")[0];

    if (!dropletId) {
      console.error("Error: Failed to create droplet.");
      process.exit(1);
    }

    console.log(`Droplet ID: ${dropletId}`);

    // Wait for droplet to be active and get IP
    console.log("Waiting for droplet to be active...");
    for (let i = 0; i < 60; i++) {
      const result = await execAsync(
        `doctl compute droplet get ${dropletId} --format ID,Status,PublicIPv4 --no-header`
      ).catch(() => ({ stdout: "" }));

      if (result.stdout) {
        const parts = result.stdout.split(" ");
        if (parts.length >= 3) {
          const status = parts[1];
          ip = parts[2];
          if (status === "active" && ip && ip !== "none") {
            break;
          }
        }
      }
      await sleep(5000);
    }

    if (!ip || ip === "none") {
      console.error("Error: Failed to get droplet IP address.");
      process.exit(1);
    }

    console.log(`Droplet IP: ${ip}`);

    // Wait for SSH to be ready
    console.log("Waiting for SSH to be ready...");
    for (let i = 0; i < 60; i++) {
      try {
        await execAsync(
          `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new -i ${sshKeyPath} root@${ip} echo ready`
        );
        break;
      } catch {
        await sleep(5000);
      }
    }

    // Create client
    const client = new SesshClient({
      alias,
      host: `root@${ip}`,
      identity: sshKeyPath,
    });

    try {
      // Open session
      console.log("Opening sessh session...");
      await client.open();

      // Install dependencies and run workload
      console.log("Installing dependencies...");
      await client.run("apt-get update -qq");
      await client.run("apt-get install -y -qq python3-pip tmux");

      console.log("Running workload...");
      await client.run('python3 -c "import sys; print(f\\"Python version: {sys.version}\\")"');
      await client.run(
        "cd /tmp && pwd && echo 'Working directory: $(pwd)' && echo 'State persisted across commands!'"
      );

      // Get logs
      console.log();
      console.log("=== Session Logs ===");
      const logs = await client.logs(100);
      console.log(logs.output || "");

      // Check status
      console.log();
      console.log("=== Session Status ===");
      const status = await client.status();
      console.log(`Master: ${status.master}, Session: ${status.session}`);

      console.log();
      console.log("Example completed successfully!");
      console.log(`Droplet ${dropletId} will be deleted on exit.`);
    } finally {
      await client.close();
    }
  } finally {
    // Cleanup
    if (dropletId) {
      console.log("Cleaning up...");
      try {
        await execAsync(`doctl compute droplet delete ${dropletId} --force`);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});


#!/usr/bin/env node
/** Example: Using sessh with Google Cloud Platform Compute Engine. */
import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";
import { SesshClient } from "../src/index.js";

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let project = process.env.GCP_PROJECT || "";
  const zone = process.env.GCP_ZONE || "us-central1-a";
  const instanceType = process.env.GCP_INSTANCE_TYPE || "n1-standard-1";
  const imageProject = process.env.GCP_IMAGE_PROJECT || "ubuntu-os-cloud";
  const imageFamily = process.env.GCP_IMAGE_FAMILY || "ubuntu-2204-lts";
  const instanceName = `sessh-example-${Date.now()}`;
  const alias = "gcp-agent";

  console.log(`=== GCP Compute Engine Sessh Example ===`);
  console.log(`Zone: ${zone}`);
  console.log(`Instance Type: ${instanceType}`);
  console.log();

  // Check prerequisites
  try {
    await execAsync("gcloud --version");
  } catch {
    console.error("Error: gcloud CLI is required but not installed.");
    process.exit(1);
  }

  // Get default project if not set
  if (!project) {
    try {
      const result = await execAsync("gcloud config get-value project");
      project = result.stdout.trim();
    } catch {
      // Ignore
    }
  }

  if (!project) {
    console.error("Error: GCP_PROJECT must be set or gcloud must be configured.");
    process.exit(1);
  }

  console.log(`Project: ${project}`);

  let ip: string | undefined;

  try {
    // Launch instance
    console.log("Creating GCP instance...");
    await execAsync(
      `gcloud compute instances create ${instanceName} --zone ${zone} --machine-type ${instanceType} --image-project ${imageProject} --image-family ${imageFamily} --project ${project} --metadata enable-oslogin=FALSE --tags sessh-example`
    );

    // Get IP address
    console.log("Getting instance IP address...");
    for (let i = 0; i < 30; i++) {
      const result = await execAsync(
        `gcloud compute instances describe ${instanceName} --zone ${zone} --project ${project} --format "get(networkInterfaces[0].accessConfigs[0].natIP)"`
      );
      ip = result.stdout.trim();
      if (ip && ip !== "None") {
        break;
      }
      await sleep(2000);
    }

    if (!ip || ip === "None") {
      console.error("Error: Failed to get instance IP address.");
      process.exit(1);
    }

    console.log(`Instance IP: ${ip}`);

    // Wait for SSH to be ready
    console.log("Waiting for SSH to be ready...");
    for (let i = 0; i < 60; i++) {
      try {
        await execAsync(`ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new ubuntu@${ip} echo ready`);
        break;
      } catch {
        await sleep(5000);
      }
    }

    // Create client
    const client = new SesshClient({
      alias,
      host: `ubuntu@${ip}`,
    });

    try {
      // Open session
      console.log("Opening sessh session...");
      await client.open();

      // Install dependencies and run workload
      console.log("Installing dependencies...");
      await client.run("sudo apt-get update -qq");
      await client.run("sudo apt-get install -y -qq python3-pip tmux");

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
      console.log(`Instance ${instanceName} will be deleted on exit.`);
    } finally {
      await client.close();
    }
  } finally {
    // Cleanup
    if (instanceName) {
      console.log("Cleaning up...");
      try {
        await execAsync(
          `gcloud compute instances delete ${instanceName} --zone ${zone} --project ${project} --quiet`
        );
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


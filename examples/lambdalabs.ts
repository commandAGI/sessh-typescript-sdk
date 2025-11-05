#!/usr/bin/env node
/** Example: Using sessh with Lambda Labs GPU instances. */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { SesshClient } from "../src/index.js";

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function makeRequest(method: string, url: string, data?: any): Promise<any> {
  const curlArgs = [
    "-s",
    "-u", `${process.env.LAMBDA_API_KEY}:`,
    "-H", "content-type: application/json",
    "-X", method,
  ];
  
  if (data) {
    curlArgs.push("-d", JSON.stringify(data));
  }
  
  curlArgs.push(url);
  
  const result = await execAsync(`curl ${curlArgs.map(arg => `"${arg}"`).join(" ")}`);
  return JSON.parse(result.stdout);
}

async function main() {
  const apiKey = process.env.LAMBDA_API_KEY || "";
  const region = process.env.LAMBDA_REGION || "us-west-1";
  const instanceType = process.env.LAMBDA_INSTANCE_TYPE || "gpu_1x_a10";
  const sshKey = process.env.LAMBDA_SSH_KEY || "";
  const alias = "lambda-agent";

  console.log(`=== Lambda Labs GPU Sessh Example ===`);
  console.log(`Region: ${region}`);
  console.log(`Instance Type: ${instanceType}`);
  console.log();

  if (!apiKey) {
    console.error("Error: LAMBDA_API_KEY environment variable must be set with your Lambda Labs API key.");
    process.exit(1);
  }

  if (!sshKey) {
    console.error("Error: LAMBDA_SSH_KEY environment variable must be set with your Lambda Labs SSH key name.");
    process.exit(1);
  }

  let instanceId: string | undefined;
  let ip: string | undefined;

  try {
    // Launch instance
    console.log("Launching Lambda Labs instance...");
    const launchData = await makeRequest("POST", "https://cloud.lambdalabs.com/api/v1/instance-operations/launch", {
      region_name: region,
      instance_type_name: instanceType,
      ssh_key_names: [sshKey],
      quantity: 1,
    });

    if (!launchData.data?.instance_ids?.[0]) {
      console.error(`Error: Failed to launch instance. Response: ${JSON.stringify(launchData)}`);
      process.exit(1);
    }

    instanceId = launchData.data.instance_ids[0];
    console.log(`Instance ID: ${instanceId}`);

    // Wait for IP
    console.log("Waiting for instance IP address...");
    for (let i = 0; i < 60; i++) {
      const instancesData = await makeRequest("GET", "https://cloud.lambdalabs.com/api/v1/instances");

      for (const inst of instancesData.data || []) {
        if (inst.id === instanceId) {
          ip = inst.ip;
          if (ip && ip !== "null") {
            break;
          }
        }
      }

      if (ip && ip !== "null") {
        break;
      }
      await sleep(5000);
    }

    if (!ip || ip === "null") {
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
      await client.run("pip install torch torchvision");
      await client.run('python3 -c "import torch; print(f\\"PyTorch version: {torch.__version__}\\")"');

      console.log("Running workload...");
      await client.run(
        "cd /tmp && pwd && echo 'Working directory: $(pwd)' && echo 'State persisted across commands!'"
      );
      await client.run("nvidia-smi || echo 'GPU check (may not be available in all instance types)'");

      // Get logs
      console.log();
      console.log("=== Session Logs ===");
      const logs = await client.logs(200);
      console.log(logs.output || "");

      // Check status
      console.log();
      console.log("=== Session Status ===");
      const status = await client.status();
      console.log(`Master: ${status.master}, Session: ${status.session}`);

      console.log();
      console.log("Example completed successfully!");
      console.log(`Instance ${instanceId} will be terminated on exit.`);
    } finally {
      await client.close();
    }
  } finally {
    // Cleanup
    if (instanceId) {
      console.log("Cleaning up...");
      try {
        await makeRequest("POST", "https://cloud.lambdalabs.com/api/v1/instance-operations/terminate", {
          instance_ids: [instanceId],
        });
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


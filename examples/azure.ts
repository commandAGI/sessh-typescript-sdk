#!/usr/bin/env node
/** Example: Using sessh with Microsoft Azure Virtual Machines. */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { SesshClient } from "../src/index.js";

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP || "sessh-example-rg";
  const location = process.env.AZURE_LOCATION || "eastus";
  const vmSize = process.env.AZURE_VM_SIZE || "Standard_B1s";
  const vmName = `sessh-example-${Date.now()}`;
  const alias = "azure-agent";

  console.log(`=== Azure VM Sessh Example ===`);
  console.log(`Resource Group: ${resourceGroup}`);
  console.log(`Location: ${location}`);
  console.log(`VM Size: ${vmSize}`);
  console.log();

  // Check prerequisites
  try {
    await execAsync("az --version");
  } catch {
    console.error("Error: Azure CLI is required but not installed.");
    process.exit(1);
  }

  // Check if logged in
  try {
    await execAsync("az account show");
  } catch {
    console.error("Error: Not logged in to Azure. Run 'az login' first.");
    process.exit(1);
  }

  // Generate SSH key if needed
  const sshKeyPath = join(homedir(), ".ssh", "id_rsa");
  if (!existsSync(sshKeyPath)) {
    console.log("Generating SSH key...");
    await execAsync(`ssh-keygen -t rsa -b 4096 -f ${sshKeyPath} -N "" -q`);
  }

  // Read public key
  const sshPubkey = readFileSync(`${sshKeyPath}.pub`, "utf-8").trim();

  let cleanupRg = false;
  let ip: string | undefined;

  try {
    // Check if resource group exists, create if not
    try {
      await execAsync(`az group show --name ${resourceGroup}`);
    } catch {
      console.log("Creating resource group...");
      await execAsync(`az group create --name ${resourceGroup} --location ${location}`);
      cleanupRg = true;
    }

    // Launch VM
    console.log("Creating Azure VM...");
    const result = await execAsync(
      `az vm create --resource-group ${resourceGroup} --name ${vmName} --image Ubuntu2204 --size ${vmSize} --admin-username azureuser --ssh-key-values "${sshPubkey}" --public-ip-sku Standard --output json`
    );
    const vmData = JSON.parse(result.stdout);
    ip = vmData.publicIpAddress;

    if (!ip) {
      console.error("Error: Failed to get VM IP address.");
      process.exit(1);
    }

    console.log(`VM IP: ${ip}`);

    // Wait for SSH to be ready
    console.log("Waiting for SSH to be ready...");
    for (let i = 0; i < 60; i++) {
      try {
        await execAsync(
          `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new -i ${sshKeyPath} azureuser@${ip} echo ready`
        );
        break;
      } catch {
        await sleep(5000);
      }
    }

    // Create client
    const client = new SesshClient({
      alias,
      host: `azureuser@${ip}`,
      identity: sshKeyPath,
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
      console.log(`VM ${vmName} will be deleted on exit.`);
    } finally {
      await client.close();
    }
  } finally {
    // Cleanup
    console.log("Cleaning up...");
    if (vmName) {
      try {
        await execAsync(`az vm delete --resource-group ${resourceGroup} --name ${vmName} --yes`);
      } catch {
        // Ignore cleanup errors
      }
    }
    if (cleanupRg) {
      try {
        await execAsync(`az group delete --name ${resourceGroup} --yes --no-wait`);
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


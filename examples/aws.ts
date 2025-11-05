#!/usr/bin/env node
/** Example: Using sessh with AWS EC2. */
import { spawn, exec } from "node:child_process";
import { promisify } from "node:util";
import { SesshClient } from "../src/index.js";

const execAsync = promisify(exec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const region = process.env.AWS_REGION || "us-east-1";
  const instanceType = process.env.INSTANCE_TYPE || "t2.micro";
  let keyName = process.env.AWS_KEY_NAME || "";
  let securityGroup = process.env.AWS_SECURITY_GROUP || "";
  const alias = "aws-agent";

  console.log(`=== AWS EC2 Sessh Example ===`);
  console.log(`Region: ${region}`);
  console.log(`Instance Type: ${instanceType}`);
  console.log();

  // Check prerequisites
  try {
    await execAsync("aws --version");
    await execAsync("jq --version");
  } catch {
    console.error("Error: AWS CLI and jq are required but not installed.");
    process.exit(1);
  }

  // Get default values if not set
  if (!keyName) {
    try {
      const result = await execAsync(
        `aws ec2 describe-key-pairs --query KeyPairs[0].KeyName --output text --region ${region}`
      );
      keyName = result.stdout.trim();
    } catch {
      // Ignore
    }
  }

  if (!keyName) {
    console.error("Error: AWS_KEY_NAME must be set or at least one key pair must exist.");
    process.exit(1);
  }

  // Get Ubuntu AMI
  let amiId = process.env.AWS_AMI_ID;
  if (!amiId) {
    const result = await execAsync(
      `aws ec2 describe-images --owners 099720109477 --filters "Name=name,Values=ubuntu/images/h2-ssd/ubuntu-jammy-22.04-amd64-server-*" "Name=state,Values=available" --query "Images | sort_by(@, &CreationDate) | [-1].ImageId" --output text --region ${region}`
    );
    amiId = result.stdout.trim();
  }

  if (!securityGroup) {
    try {
      const result = await execAsync(
        `aws ec2 describe-security-groups --filters "Name=ip-permission.from-port,Values=22" "Name=ip-permission.to-port,Values=22" "Name=ip-permission.protocol,Values=tcp" --query SecurityGroups[0].GroupId --output text --region ${region}`
      );
      securityGroup = result.stdout.trim();
    } catch {
      // Ignore
    }
  }

  if (!securityGroup) {
    console.error(
      "Error: AWS_SECURITY_GROUP must be set or a security group allowing SSH must exist."
    );
    process.exit(1);
  }

  let instanceId: string | undefined;
  let ip: string | undefined;

  try {
    // Launch instance
    console.log("Launching EC2 instance...");
    const launchResult = await execAsync(
      `aws ec2 run-instances --image-id ${amiId} --instance-type ${instanceType} --key-name ${keyName} --security-group-ids ${securityGroup} --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=sessh-example}]" --region ${region} --output json`
    );
    const launchData = JSON.parse(launchResult.stdout);
    instanceId = launchData.Instances[0].InstanceId;
    console.log(`Instance ID: ${instanceId}`);

    // Wait for instance to be running
    console.log("Waiting for instance to be running...");
    await execAsync(
      `aws ec2 wait instance-running --instance-ids ${instanceId} --region ${region}`
    );

    // Get IP address
    console.log("Getting instance IP address...");
    for (let i = 0; i < 30; i++) {
      const result = await execAsync(
        `aws ec2 describe-instances --instance-ids ${instanceId} --query Reservations[0].Instances[0].PublicIpAddress --output text --region ${region}`
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
      console.log(`Instance ${instanceId} will be terminated on exit.`);
    } finally {
      await client.close();
    }
  } finally {
    // Cleanup
    if (instanceId) {
      console.log("Cleaning up...");
      try {
        await execAsync(
          `aws ec2 terminate-instances --instance-ids ${instanceId} --region ${region}`
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


# Sessh TypeScript SDK

Promise-based TypeScript client for [sessh](https://github.com/CommandAGI/sessh) - manage persistent SSH sessions from TypeScript/JavaScript.

## Installation

```bash
npm install
npm run build
```

Or as a dependency:

```bash
npm install git+https://github.com/CommandAGI/sessh-typescript-sdk.git
```

## Prerequisites

- Node.js 18+
- The `sessh` CLI must be installed and on your PATH

## Usage

```typescript
import { SesshClient } from "sessh-sdk";

// Create a client
const client = new SesshClient({
  alias: "agent",
  host: "ubuntu@203.0.113.10",
  identity: "~/.ssh/id_ed25519"
});

// Open a session
await client.open();

// Run commands
await client.run("python train.py");

// Get logs
const logs = await client.logs(400);
console.log(logs.output);

// Check status
const status = await client.status();
console.log(`Master: ${status.master}, Session: ${status.session}`);

// Close session
await client.close();
```

## API Reference

### `SesshClient(options: SesshOptions)`

Initialize a sessh client.

**Options:**
- `alias` (string): Session alias name
- `host` (string): SSH host (user@host)
- `port` (number, optional): SSH port (default: 22)
- `sesshBin` (string, optional): Path to sessh binary (default: "sessh" from PATH)
- `identity` (string, optional): Path to SSH private key
- `proxyjump` (string, optional): ProxyJump host (e.g., "bastionuser@bastion")

### Methods

#### `open(): Promise<SesshResponse>`
Open or ensure a persistent remote tmux session.

#### `run(command: string): Promise<SesshResponse>`
Send a command into the persistent tmux session.

#### `logs(lines?: number): Promise<LogsResponse>`
Capture recent output from the tmux session.

#### `status(): Promise<StatusResponse>`
Check whether the SSH controlmaster and tmux session exist.

#### `close(): Promise<SesshResponse>`
Kill tmux session and close the controlmaster.

## Types

```typescript
interface SesshResponse {
  ok: boolean;
  op: string;
  [key: string]: unknown;
}

interface LogsResponse extends SesshResponse {
  output?: string;
  lines?: number;
}

interface StatusResponse extends SesshResponse {
  master: number;
  session: number;
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Examples

Comprehensive examples are available in the [`examples/`](examples/) directory. Each example demonstrates launching infrastructure, using sessh to manage persistent sessions, and cleaning up resources.

### Quick Examples

#### Local/Localhost

```typescript
import { SesshClient } from "sessh-sdk";

const client = new SesshClient({
  alias: "local-test",
  host: "user@localhost"
});

await client.open();
await client.run("echo 'Hello from sessh!'");
const logs = await client.logs(50);
console.log(logs.output);
await client.close();
```

#### AWS EC2

```typescript
import { SesshClient } from "sessh-sdk";

// Launch EC2 instance, get IP (example)
const ip = "203.0.113.10";
const client = new SesshClient({
  alias: "aws-agent",
  host: `ubuntu@${ip}`
});

await client.open();
await client.run("python train.py");
const logs = await client.logs(400);
await client.close();
```

#### Lambda Labs GPU

```typescript
import { SesshClient } from "sessh-sdk";

// Launch Lambda Labs instance, get IP (example)
const ip = "203.0.113.10";
const client = new SesshClient({
  alias: "lambda-agent",
  host: `ubuntu@${ip}`,
  identity: "~/.ssh/id_ed25519"
});

await client.open();
await client.run("pip install torch torchvision");
await client.run("python train.py");
const logs = await client.logs(400);
console.log(logs.output);
await client.close();
```

### Available Examples

All examples follow the same pattern:
1. Launch infrastructure (instance/container)
2. Wait for SSH to be ready
3. Open sessh session
4. Run commands (state persists between commands)
5. Fetch logs
6. Clean up resources

**Example Files:**
- [`examples/local.ts`](examples/local.ts) - Localhost/local VM
- [`examples/docker.ts`](examples/docker.ts) - Docker container
- [`examples/aws.ts`](examples/aws.ts) - AWS EC2
- [`examples/gcp.ts`](examples/gcp.ts) - Google Cloud Platform
- [`examples/lambdalabs.ts`](examples/lambdalabs.ts) - Lambda Labs GPU
- [`examples/azure.ts`](examples/azure.ts) - Microsoft Azure
- [`examples/digitalocean.ts`](examples/digitalocean.ts) - DigitalOcean
- [`examples/docker-compose.ts`](examples/docker-compose.ts) - Docker Compose

**Running Examples:**
```bash
# Build first
npm run build

# Local example
node dist/examples/local.js localhost

# AWS example (requires AWS credentials)
export AWS_REGION=us-east-1
export AWS_KEY_NAME=my-key
node dist/examples/aws.js

# Lambda Labs example (requires API key)
export LAMBDA_API_KEY=sk_live_...
export LAMBDA_SSH_KEY=my-ssh-key
node dist/examples/lambdalabs.js
```

### Integration Tests

Integration tests are available in [`tests/examples.test.ts`](tests/examples.test.ts). These tests require real infrastructure and are skipped by default.

**Running Integration Tests:**
```bash
# Enable integration tests
export SESSH_INTEGRATION_TESTS=1

# For local tests
export SESSH_TEST_HOST=localhost
npm test -- tests/examples.test.ts
```

### Error Handling

```typescript
import { SesshClient } from "sessh-sdk";

const client = new SesshClient({
  alias: "test",
  host: "ubuntu@host"
});

try {
  await client.open();
  await client.run("some-command");
} catch (error) {
  console.error("Error:", error);
  process.exit(1);
} finally {
  await client.close();
}
```

## Troubleshooting

**"sessh: command not found"**
- Ensure `sessh` CLI is installed and on PATH
- Or set `sesshBin` option: `new SesshClient({ ..., sesshBin: "/usr/local/bin/sessh" })`

**Error on operations**
- Check that `sessh` CLI works from command line
- Verify SSH key permissions and configuration
- Ensure remote host has tmux installed

**JSON parsing errors**
- The SDK automatically sets `SESSH_JSON=1`
- Verify `sessh` CLI supports JSON output

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Related Projects

- [sessh](https://github.com/CommandAGI/sessh) - Core CLI
- [sessh-mcp](https://github.com/CommandAGI/sessh-mcp) - MCP server for Cursor
- [sessh-python-sdk](https://github.com/CommandAGI/sessh-python-sdk) - Python SDK

## License

MIT License - see LICENSE file for details.


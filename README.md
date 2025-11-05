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

## Related Projects

- [sessh](https://github.com/CommandAGI/sessh) - Core CLI
- [sessh-mcp](https://github.com/CommandAGI/sessh-mcp) - MCP server for Cursor
- [sessh-python-sdk](https://github.com/CommandAGI/sessh-python-sdk) - Python SDK

## License

MIT License - see LICENSE file for details.


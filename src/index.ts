/**
 * Sessh TypeScript SDK - Promise-based client for managing persistent SSH sessions.
 */

import { spawn } from "node:child_process";

export interface SesshOptions {
  alias: string;
  host: string;
  port?: number;
  sesshBin?: string;
  identity?: string;
  proxyjump?: string;
}

export interface SesshResponse {
  ok: boolean;
  op: string;
  [key: string]: unknown;
}

export interface LogsResponse extends SesshResponse {
  output?: string;
  lines?: number;
}

export interface StatusResponse extends SesshResponse {
  master: number;
  session: number;
}

function runSessh(
  args: string[],
  options: SesshOptions
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const sesshBin = options.sesshBin || "sessh";
    const env = { ...process.env, SESSH_JSON: "1" };
    if (options.identity) {
      env.SESSH_IDENTITY = options.identity;
    }
    if (options.proxyjump) {
      env.SESSH_PROXYJUMP = options.proxyjump;
    }

    const proc = spawn(sesshBin, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env,
    });

    let out = "",
      err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) =>
      resolve({ code: code ?? 0, stdout: out.trim(), stderr: err.trim() })
    );
  });
}

function parseResponse<T extends SesshResponse>(
  result: { code: number; stdout: string; stderr: string }
): T {
  if (result.code !== 0 && !result.stdout) {
    throw new Error(
      result.stderr || `sessh failed with exit code ${result.code}`
    );
  }
  try {
    return JSON.parse(result.stdout) as T;
  } catch (e) {
    throw new Error(`Invalid JSON from sessh: ${result.stdout}`);
  }
}

export class SesshClient {
  private options: SesshOptions;

  constructor(options: SesshOptions) {
    this.options = options;
  }

  /**
   * Open or ensure a persistent remote tmux session.
   */
  async open(): Promise<SesshResponse> {
    const args = ["open", this.options.alias, this.options.host];
    if (this.options.port) {
      args.push(String(this.options.port));
    }
    const result = await runSessh(args, this.options);
    return parseResponse<SesshResponse>(result);
  }

  /**
   * Send a command into the persistent tmux session.
   */
  async run(command: string): Promise<SesshResponse> {
    const args = [
      "run",
      this.options.alias,
      this.options.host,
      "--",
      command,
    ];
    const result = await runSessh(args, this.options);
    return parseResponse<SesshResponse>(result);
  }

  /**
   * Capture recent output from the tmux session.
   */
  async logs(lines: number = 300): Promise<LogsResponse> {
    const args = ["logs", this.options.alias, this.options.host, String(lines)];
    const result = await runSessh(args, this.options);
    return parseResponse<LogsResponse>(result);
  }

  /**
   * Check whether the SSH controlmaster and tmux session exist.
   */
  async status(): Promise<StatusResponse> {
    const args = ["status", this.options.alias, this.options.host];
    if (this.options.port) {
      args.push(String(this.options.port));
    }
    const result = await runSessh(args, this.options);
    return parseResponse<StatusResponse>(result);
  }

  /**
   * Kill tmux session and close the controlmaster.
   */
  async close(): Promise<SesshResponse> {
    const args = ["close", this.options.alias, this.options.host];
    if (this.options.port) {
      args.push(String(this.options.port));
    }
    const result = await runSessh(args, this.options);
    return parseResponse<SesshResponse>(result);
  }

  /**
   * Attach to the tmux session interactively.
   * Note: This method is not fully implemented for non-interactive use.
   * Use the CLI directly for interactive attachment.
   */
  async attach(): Promise<void> {
    // For interactive attach, we'd need to use spawn with inherited stdio
    // This is better handled via CLI directly
    throw new Error(
      "Interactive attach not supported via SDK. Use CLI: sessh attach"
    );
  }

  /**
   * Send individual key events to the tmux session (no Enter key).
   * Useful for interactive TUI programs like vim or nano.
   */
  async keys(keySequence: string): Promise<SesshResponse> {
    const args = [
      "keys",
      this.options.alias,
      this.options.host,
      "--",
      keySequence,
    ];
    const result = await runSessh(args, this.options);
    return parseResponse<SesshResponse>(result);
  }

  /**
   * Read the current pane state from the tmux session.
   * Useful for reading the current state of interactive TUI programs.
   */
  async pane(lines: number = 300): Promise<LogsResponse> {
    const args = ["pane", this.options.alias, this.options.host, String(lines)];
    const result = await runSessh(args, this.options);
    return parseResponse<LogsResponse>(result);
  }
}


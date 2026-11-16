import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const PACKAGE = "wolt-mcp-server";
const SERVER_NAME = "wolt";

export interface Launch {
  command: string;
  args: string[];
}

export interface McpClient {
  name: string;
  available(): boolean;
  install(launch: Launch): void;
}

export function resolveLaunch(
  scriptPath: string,
  platform: string = process.platform,
  node: string = process.execPath,
): Launch {
  if (!scriptPath.includes("node_modules")) return { command: node, args: [scriptPath] };
  const npx = ["npx", "-y", PACKAGE];
  return platform === "win32" ? { command: "cmd", args: ["/c", ...npx] } : { command: npx[0], args: npx.slice(1) };
}

export function mergeServerEntry(existing: string | undefined, launch: Launch): string {
  const config = existing?.trim() ? JSON.parse(existing) : {};
  config.mcpServers = { ...config.mcpServers, [SERVER_NAME]: launch };
  return `${JSON.stringify(config, null, 2)}\n`;
}

function claudeDesktopConfig(home: string, platform: string, env: NodeJS.ProcessEnv): string {
  const file = "claude_desktop_config.json";
  if (platform === "darwin") return join(home, "Library", "Application Support", "Claude", file);
  if (platform === "win32") return join(env.APPDATA ?? join(home, "AppData", "Roaming"), "Claude", file);
  return join(home, ".config", "Claude", file);
}

export function mcpClients(
  home: string = homedir(),
  platform: string = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): McpClient[] {
  const shell = platform === "win32";

  const fileClient = (name: string, path: string): McpClient => ({
    name,
    available: () => existsSync(dirname(path)),
    install: (launch) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, mergeServerEntry(existsSync(path) ? readFileSync(path, "utf8") : undefined, launch));
    },
  });

  const commandClient = (name: string, bin: string, args: (launch: Launch) => string[]): McpClient => ({
    name,
    available: () => spawnSync(bin, ["--version"], { shell, stdio: "ignore" }).status === 0,
    install: (launch) => {
      const { status } = spawnSync(bin, args(launch), { shell, stdio: "inherit" });
      if (status !== 0) throw new Error(`${bin} exited with code ${status}`);
    },
  });

  return [
    commandClient("Claude Code", "claude", ({ command, args }) => [
      "mcp",
      "add",
      "--scope",
      "user",
      SERVER_NAME,
      "--",
      command,
      ...args,
    ]),
    commandClient("Codex", "codex", ({ command, args }) => ["mcp", "add", SERVER_NAME, "--", command, ...args]),
    fileClient("Cursor", join(home, ".cursor", "mcp.json")),
    fileClient("Claude Desktop", claudeDesktopConfig(home, platform, env)),
  ];
}

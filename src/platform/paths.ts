import { homedir } from "node:os";
import { join } from "node:path";

const APP_DIR = "wolt-mcp";

export function configDir(env: NodeJS.ProcessEnv = process.env, platform: string = process.platform): string {
  if (env.WOLT_MCP_HOME) return env.WOLT_MCP_HOME;
  if (platform === "win32" && env.APPDATA) return join(env.APPDATA, APP_DIR);
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), APP_DIR);
}

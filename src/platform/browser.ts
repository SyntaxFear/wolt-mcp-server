import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const MAC = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];
const LINUX = [
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/brave-browser",
  "/usr/bin/microsoft-edge",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
];

function windows(env: NodeJS.ProcessEnv): string[] {
  const roots = [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter((root) => root !== undefined);
  const apps = [
    "Google\\Chrome\\Application\\chrome.exe",
    "BraveSoftware\\Brave-Browser\\Application\\brave.exe",
    "Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return roots.flatMap((root) => apps.map((app) => join(root, app)));
}

/** An installed Chromium-family browser, the only kind that can be opened with its own profile and watched. */
export function findBrowser(
  env: NodeJS.ProcessEnv = process.env,
  platform: string = process.platform,
  exists: (path: string) => boolean = existsSync,
): string | undefined {
  if (env.WOLT_MCP_BROWSER) return env.WOLT_MCP_BROWSER;
  const candidates =
    platform === "darwin"
      ? [...MAC, ...MAC.map((path) => join(homedir(), path))]
      : platform === "win32"
        ? windows(env)
        : LINUX;
  return candidates.find(exists);
}

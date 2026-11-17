import { join } from "node:path";
import { loginInWindow } from "../auth/loginWindow.js";
import { createSession, refreshTokenIn } from "../auth/session.js";
import { createSecretStore } from "../auth/store.js";
import { findBrowser } from "../platform/browser.js";
import { configDir } from "../platform/paths.js";

const LOGIN_TIMEOUT_MS = 5 * 60_000;

const store = () => createSecretStore(configDir());

export async function login(): Promise<void> {
  const browser = findBrowser();
  if (!browser) {
    console.error("No Chrome, Brave, Edge or Chromium found. Install one, or set WOLT_MCP_BROWSER to its path.");
    process.exit(1);
  }
  console.log("A browser window is opening on Wolt's own login page.");
  console.log("Log in there yourself. This tool never sees your phone code or email link.");
  console.log("The window closes by itself once you are logged in (it waits 5 minutes).\n");
  const secrets = store();
  const refreshToken = await loginInWindow({
    browser,
    profileDir: join(configDir(), "login-profile"),
    timeoutMs: LOGIN_TIMEOUT_MS,
    pick: refreshTokenIn,
  });
  secrets.set(refreshToken);
  await createSession(secrets).accessToken();
  console.log(`Logged in. The session is kept in: ${secrets.place}.`);
  console.log("Remove it any time with: npx wolt-mcp-server logout");
}

export async function logout(): Promise<void> {
  createSession(store()).logout();
  console.log("Logged out. The stored Wolt session was removed from this computer.");
}

export async function status(): Promise<void> {
  const secrets = store();
  if (!secrets.get()) {
    console.log("Not logged in. Browsing works without it. Log in with: npx wolt-mcp-server login");
    return;
  }
  try {
    await createSession(secrets).accessToken();
    console.log(`Logged in. Session kept in: ${secrets.place}.`);
  } catch (error) {
    console.log(`The stored session does not work: ${error instanceof Error ? error.message : error}`);
  }
}

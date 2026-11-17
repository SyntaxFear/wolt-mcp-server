import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { WoltError } from "../errors.js";

export const LOGIN_URL = "https://wolt.com/en/me";
const POLL_MS = 1500;
const CLOSE_GRACE_MS = 4000;
const PORT_FILE = "DevToolsActivePort";

export interface Cookie {
  name: string;
  value: string;
  domain: string;
}

export interface LoginWindowOptions {
  browser: string;
  profileDir: string;
  timeoutMs: number;
  /** Returns the session once the cookies hold one. */
  pick(cookies: Cookie[]): string | undefined;
  url?: string;
  extraArgs?: string[];
}

interface Devtools {
  send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
  close(): void;
}

function connect(endpoint: string): Promise<Devtools> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const waiting = new Map<number, (result: Record<string, unknown>) => void>();
    let nextId = 1;
    socket.addEventListener("error", () => reject(new Error("could not reach the login window")));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: Record<string, unknown> };
      if (message.id === undefined) return;
      waiting.get(message.id)?.(message.result ?? {});
      waiting.delete(message.id);
    });
    socket.addEventListener("open", () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((done) => {
            const id = nextId++;
            waiting.set(id, done);
            socket.send(JSON.stringify({ id, method, params }));
          }),
        close: () => socket.close(),
      }),
    );
  });
}

async function devtoolsEndpoint(profileDir: string, browser: ChildProcess, deadline: number): Promise<string> {
  const file = join(profileDir, PORT_FILE);
  while (Date.now() < deadline && browser.exitCode === null) {
    if (existsSync(file)) {
      const [port, path] = readFileSync(file, "utf8").trim().split("\n");
      if (port && path) return `ws://127.0.0.1:${port}${path}`;
    }
    await delay(100);
  }
  throw new WoltError(
    "INTERNAL",
    "The login window did not start.",
    "Close other copies of that browser and try again.",
  );
}

/**
 * Opens Wolt's own login page in a browser window that has its own empty profile, waits for the user to log in
 * there, and returns the session it then holds. Nothing is typed or clicked for the user, and the user's
 * everyday browser profile is never read.
 */
export async function loginInWindow(options: LoginWindowOptions): Promise<string> {
  mkdirSync(options.profileDir, { recursive: true });
  rmSync(join(options.profileDir, PORT_FILE), { force: true });
  const browser = spawn(
    options.browser,
    [
      `--user-data-dir=${options.profileDir}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      ...(options.extraArgs ?? []),
      options.url ?? LOGIN_URL,
    ],
    { stdio: "ignore" },
  );
  const deadline = Date.now() + options.timeoutMs;
  let devtools: Devtools | undefined;
  try {
    devtools = await connect(await devtoolsEndpoint(options.profileDir, browser, deadline));
    while (Date.now() < deadline && browser.exitCode === null) {
      const { cookies } = (await devtools.send("Storage.getCookies")) as { cookies?: Cookie[] };
      const session = options.pick(cookies ?? []);
      if (session) return session;
      await delay(POLL_MS);
    }
    throw new WoltError(
      "LOGIN_REQUIRED",
      browser.exitCode === null
        ? "Nobody logged in to Wolt in time."
        : "The login window was closed before logging in.",
      "Run `npx wolt-mcp-server login` and log in to Wolt in the window that opens.",
    );
  } finally {
    // Ask the browser to quit so its helper processes go with it; kill only if it does not.
    const exited = new Promise<void>((done) => browser.once("exit", () => done()));
    devtools?.send("Browser.close").catch(() => undefined);
    await Promise.race([exited, delay(CLOSE_GRACE_MS)]);
    devtools?.close();
    if (browser.exitCode === null) browser.kill();
  }
}

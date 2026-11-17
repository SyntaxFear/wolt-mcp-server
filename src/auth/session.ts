import { z } from "zod";
import { WoltError } from "../errors.js";
import type { Cookie } from "./loginWindow.js";
import type { SecretStore } from "./store.js";

const REFRESH_URL = "https://authentication.wolt.com/v1/wauth2/access_token";
const REFRESH_COOKIE = "__wrtoken";
const EARLY_MS = 60_000;
const DEFAULT_LIFETIME_S = 1800;

const TokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).nullish(),
  expires_in: z.number().positive().nullish(),
});

export interface Session {
  /** A valid access token, refreshed when needed. Throws LOGIN_REQUIRED when there is no usable session. */
  accessToken(): Promise<string>;
  loggedIn(): boolean;
  logout(): void;
}

const loginRequired = (message: string): WoltError =>
  new WoltError("LOGIN_REQUIRED", message, "Ask the user to run `npx wolt-mcp-server login` and log in to Wolt.");

/** Wolt keeps the refresh token in a cookie, either bare or wrapped in URL-encoded JSON. */
export function refreshTokenIn(cookies: Cookie[]): string | undefined {
  const cookie = cookies.find((entry) => entry.name === REFRESH_COOKIE && /(^|\.)wolt\.com$/.test(entry.domain));
  if (!cookie?.value) return undefined;
  const text = decodeURIComponent(cookie.value);
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "string") return parsed || undefined;
    if (typeof parsed === "object" && parsed !== null) {
      const { refreshToken, refresh_token, token, value } = parsed as Record<string, unknown>;
      const found = [refreshToken, refresh_token, token, value].find((entry) => typeof entry === "string" && entry);
      return typeof found === "string" ? found : undefined;
    }
  } catch {
    // not JSON: the cookie is the token itself
  }
  return text;
}

export function createSession(store: SecretStore, send: typeof fetch = fetch, now: () => number = Date.now): Session {
  let access: { token: string; expires: number } | undefined;
  let refreshing: Promise<string> | undefined;

  async function refresh(): Promise<string> {
    const refreshToken = store.get();
    if (!refreshToken) throw loginRequired("Not logged in to Wolt.");
    const response = await send(REFRESH_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }).toString(),
    }).catch(() => undefined);
    if (!response) {
      throw new WoltError("NETWORK", "Could not reach Wolt to renew the session.", "Check the internet connection.");
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      store.clear();
      throw loginRequired("The Wolt session has expired or was signed out.");
    }
    const parsed = TokenSchema.safeParse(await response.json().catch(() => undefined));
    if (!response.ok || !parsed.success) {
      throw new WoltError(
        "WOLT_API_CHANGED",
        `Wolt answered ${response.status} when renewing the session.`,
        "Run `npx wolt-mcp-server doctor`, then update wolt-mcp-server to the latest version.",
      );
    }
    // Wolt may rotate the refresh token: the old one stops working once a new one is issued.
    if (parsed.data.refresh_token && parsed.data.refresh_token !== refreshToken) store.set(parsed.data.refresh_token);
    access = {
      token: parsed.data.access_token,
      expires: now() + (parsed.data.expires_in ?? DEFAULT_LIFETIME_S) * 1000,
    };
    return access.token;
  }

  return {
    accessToken() {
      if (access && access.expires - EARLY_MS > now()) return Promise.resolve(access.token);
      refreshing ??= refresh().finally(() => {
        refreshing = undefined;
      });
      return refreshing;
    },
    loggedIn: () => store.get() !== undefined,
    logout() {
      access = undefined;
      store.clear();
    },
  };
}

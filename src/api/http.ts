import { setTimeout as delay } from "node:timers/promises";
import type { z } from "zod";
import { WoltError } from "../errors.js";
import { VERSION } from "../version.js";
import { validate } from "./validate.js";

export const CONSUMER_API = "https://consumer-api.wolt.com";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export interface RequestOptions<T> {
  schema: z.ZodType<T>;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  language?: string;
}

export interface WoltHttp {
  get<T>(path: string, options: RequestOptions<T>): Promise<T>;
  post<T>(path: string, options: RequestOptions<T>): Promise<T>;
}

export interface HttpDeps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<unknown>;
}

export function createHttp({ fetch: send = globalThis.fetch, sleep = delay }: HttpDeps = {}): WoltHttp {
  async function attempt(url: URL, init: RequestInit): Promise<Response> {
    for (let tries = 1; ; tries++) {
      const last = tries === MAX_ATTEMPTS;
      const response = await send(url, init).catch(() => undefined);
      if (response?.ok) return response;
      const retryable = response === undefined || RETRYABLE.has(response.status);
      if (!retryable || last) throw failure(url.pathname, response?.status);
      await sleep(BASE_DELAY_MS * 2 ** (tries - 1));
    }
  }

  async function request<T>(method: string, path: string, options: RequestOptions<T>): Promise<T> {
    const url = new URL(path, CONSUMER_API);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = { accept: "application/json", "user-agent": `wolt-mcp-server/${VERSION}` };
    if (options.language) headers["app-language"] = options.language;
    if (options.body !== undefined) headers["content-type"] = "application/json";
    const body = options.body === undefined ? undefined : JSON.stringify(options.body);
    const response = await attempt(url, { method, headers, body });
    return validate(url.pathname, options.schema, await response.json());
  }

  return {
    get: (path, options) => request("GET", path, options),
    post: (path, options) => request("POST", path, options),
  };
}

function failure(endpoint: string, status: number | undefined): WoltError {
  if (status === undefined) {
    return new WoltError(
      "NETWORK",
      `Could not reach Wolt (${endpoint}).`,
      "Check the internet connection and try again.",
    );
  }
  if (status === 404) {
    return new WoltError(
      "NOT_FOUND",
      `Wolt has nothing at ${endpoint}.`,
      "Check the venue slug or id with wolt_search.",
    );
  }
  if (status === 429) {
    return new WoltError("RATE_LIMITED", "Wolt is limiting requests.", "Wait a minute before trying again.");
  }
  return new WoltError(
    "WOLT_API_CHANGED",
    `Wolt answered ${status} for ${endpoint}.`,
    "Run `npx wolt-mcp-server doctor`, then update wolt-mcp-server to the latest version.",
  );
}

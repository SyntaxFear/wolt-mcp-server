import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHttp } from "../src/api/http.js";
import { type Config, createConfigStore } from "../src/config.js";
import type { ToolContext } from "../src/tools/defineTool.js";

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
}

export type Routes = Record<string, unknown>;
export type FakeFetch = typeof fetch & { calls: { url: string; init?: RequestInit }[] };

export function fakeFetch(routes: Routes): FakeFetch {
  const calls: FakeFetch["calls"] = [];
  const handler = async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, init });
    const match = Object.keys(routes)
      .filter((fragment) => url.includes(fragment))
      .sort((a, b) => b.length - a.length)[0];
    if (match === undefined) return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(routes[match]), { status: 200 });
  };
  return Object.assign(handler, { calls }) as FakeFetch;
}

export const TBILISI = { lat: 41.7151, lon: 44.8271, label: "Tbilisi" };

const picture = (async () =>
  new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } })) as typeof fetch;

export function testContext(
  routes: Routes,
  config: Partial<Config> = { location: TBILISI },
): ToolContext & { fetch: FakeFetch } {
  const fetch = fakeFetch(routes);
  const store = createConfigStore(mkdtempSync(join(tmpdir(), "wolt-mcp-")));
  store.update(config);
  return { http: createHttp({ fetch }), config: store, fetchImage: picture, fetch };
}

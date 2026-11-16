import { readFileSync } from "node:fs";

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

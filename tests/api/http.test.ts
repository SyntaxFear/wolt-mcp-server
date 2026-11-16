import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createHttp } from "../../src/api/http.js";
import { fakeFetch } from "../helpers.js";

const schema = z.object({ ok: z.boolean() });
const sleep = async () => {};
const sequence = (...responses: (Response | Error)[]) => {
  let index = 0;
  return (async () => {
    const next = responses[index++];
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
};
const ok = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

describe("http", () => {
  it("builds the URL, skips undefined query values, sends the language", async () => {
    const fetch = fakeFetch({ "/v1/thing": { ok: true } });
    const http = createHttp({ fetch, sleep });
    await http.get("/v1/thing", { schema, query: { lat: 41.7, skip: undefined }, language: "ka" });
    expect(fetch.calls[0].url).toBe("https://consumer-api.wolt.com/v1/thing?lat=41.7");
    expect(new Headers(fetch.calls[0].init?.headers).get("app-language")).toBe("ka");
    expect(new Headers(fetch.calls[0].init?.headers).get("user-agent")).toMatch(/^wolt-mcp-server\//);
  });

  it("posts JSON bodies", async () => {
    const fetch = fakeFetch({ "/v1/search": { ok: true } });
    await createHttp({ fetch, sleep }).post("/v1/search", { schema, body: { q: "pizza" } });
    expect(fetch.calls[0].init?.method).toBe("POST");
    expect(fetch.calls[0].init?.body).toBe('{"q":"pizza"}');
  });

  it("retries 429 and 5xx, then succeeds", async () => {
    const fetch = sequence(new Response("", { status: 429 }), new Response("", { status: 503 }), ok());
    await expect(createHttp({ fetch, sleep }).get("/x", { schema })).resolves.toEqual({ ok: true });
  });

  it("maps a lasting 429 to RATE_LIMITED", async () => {
    const tooMany = () => new Response("", { status: 429 });
    const fetch = sequence(tooMany(), tooMany(), tooMany());
    await expect(createHttp({ fetch, sleep }).get("/x", { schema })).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("maps 404 to NOT_FOUND without retrying", async () => {
    const fetch = sequence(new Response("", { status: 404 }));
    await expect(createHttp({ fetch, sleep }).get("/x", { schema })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("maps network failures to NETWORK after retries", async () => {
    const fetch = sequence(new Error("down"), new Error("down"), new Error("down"));
    await expect(createHttp({ fetch, sleep }).get("/x", { schema })).rejects.toMatchObject({ code: "NETWORK" });
  });

  it("maps an unexpected body to WOLT_API_CHANGED", async () => {
    const fetch = fakeFetch({ "/x": { ok: "yes" } });
    await expect(createHttp({ fetch, sleep }).get("/x", { schema })).rejects.toMatchObject({
      code: "WOLT_API_CHANGED",
    });
  });
});

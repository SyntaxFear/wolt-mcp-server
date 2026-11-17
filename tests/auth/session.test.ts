import { expect, it } from "vitest";
import { createSession, refreshTokenIn } from "../../src/auth/session.js";
import type { SecretStore } from "../../src/auth/store.js";

function memoryStore(initial?: string): SecretStore & { value?: string } {
  const store = {
    place: "memory",
    value: initial,
    get: () => store.value,
    set: (secret: string) => {
      store.value = secret;
    },
    clear: () => {
      store.value = undefined;
    },
  };
  return store;
}

const answer = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

it("reads the refresh token from Wolt's cookie, bare or wrapped in JSON, and only from wolt.com", () => {
  const cookie = (value: string, domain = ".wolt.com") => [{ name: "__wrtoken", value, domain }];
  expect(refreshTokenIn(cookie("abc123"))).toBe("abc123");
  expect(refreshTokenIn(cookie(encodeURIComponent('"abc123"')))).toBe("abc123");
  expect(refreshTokenIn(cookie(encodeURIComponent('{"refreshToken":"abc123","expirationTime":1}')))).toBe("abc123");
  expect(refreshTokenIn(cookie("abc123", "evil-wolt.com"))).toBeUndefined();
  expect(refreshTokenIn([{ name: "__wtoken", value: "x", domain: "wolt.com" }])).toBeUndefined();
});

it("renews the access token once, reuses it until shortly before it expires, and keeps a rotated refresh token", async () => {
  let clock = 0;
  let calls = 0;
  const store = memoryStore("refresh-1");
  const send = (async (_url: unknown, init?: RequestInit) => {
    calls++;
    expect(String(init?.body)).toBe(`grant_type=refresh_token&refresh_token=refresh-${calls}`);
    return new Response(
      JSON.stringify({ access_token: `access-${calls}`, refresh_token: `refresh-${calls + 1}`, expires_in: 600 }),
    );
  }) as typeof fetch;
  const session = createSession(store, send, () => clock);
  expect(await Promise.all([session.accessToken(), session.accessToken()])).toEqual(["access-1", "access-1"]);
  expect(store.value).toBe("refresh-2");
  clock = 500_000;
  expect(await session.accessToken()).toBe("access-1");
  clock = 541_000;
  expect(await session.accessToken()).toBe("access-2");
  expect(calls).toBe(2);
});

it("asks for a login when nothing is stored, and forgets a session Wolt rejects", async () => {
  await expect(createSession(memoryStore(), answer(200, {})).accessToken()).rejects.toMatchObject({
    code: "LOGIN_REQUIRED",
  });
  const store = memoryStore("stale");
  const rejected = createSession(store, answer(401, { error_code: 126, msg: "invalid credentials" }));
  await expect(rejected.accessToken()).rejects.toMatchObject({ code: "LOGIN_REQUIRED" });
  expect(store.value).toBeUndefined();
});

it("keeps the session when Wolt is down or answers something unexpected", async () => {
  const store = memoryStore("good");
  await expect(createSession(store, answer(503, {})).accessToken()).rejects.toMatchObject({ code: "WOLT_API_CHANGED" });
  const offline = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  await expect(createSession(store, offline).accessToken()).rejects.toMatchObject({ code: "NETWORK" });
  expect(store.value).toBe("good");
});

it("logs out", () => {
  const store = memoryStore("good");
  const session = createSession(store);
  expect(session.loggedIn()).toBe(true);
  session.logout();
  expect(session.loggedIn()).toBe(false);
});

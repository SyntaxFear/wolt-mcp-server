import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createSecretStore, fileStore, macKeychain } from "../../src/auth/store.js";

it("hands the secret to the macOS Keychain on stdin, never as a command-line argument", () => {
  const calls: { command: string; args: string[]; input?: string }[] = [];
  const keychain = macKeychain((command, args, input) => {
    calls.push({ command, args, input });
    return { ok: true, out: "stored-secret" };
  });
  keychain.set('se"cr\\et');
  expect(calls[0].args).toEqual(["-i"]);
  expect(calls[0].args.join(" ")).not.toContain("se");
  expect(calls[0].input).toBe('add-generic-password -U -s wolt-mcp-server -a wolt-session -w "se\\"cr\\\\et"\n');
  expect(keychain.get()).toBe("stored-secret");
});

it("reports nothing stored when the Keychain has no entry", () => {
  expect(macKeychain(() => ({ ok: false, out: "" })).get()).toBeUndefined();
});

it("falls back to a file only the user can read", () => {
  const dir = mkdtempSync(join(tmpdir(), "wolt-mcp-"));
  const store = fileStore(dir);
  expect(store.get()).toBeUndefined();
  store.set("secret");
  expect(store.get()).toBe("secret");
  if (process.platform !== "win32") expect(statSync(join(dir, "session")).mode & 0o777).toBe(0o600);
  store.clear();
  expect(store.get()).toBeUndefined();
});

it("picks the store for the platform", () => {
  const none = () => ({ ok: false, out: "" });
  expect(createSecretStore("/x", "darwin", none).place).toBe("macOS Keychain");
  expect(createSecretStore("/x", "linux", () => ({ ok: true, out: "" })).place).toBe("system keyring");
  expect(createSecretStore("/x", "linux", none).place).toContain("no system keychain");
  expect(createSecretStore("/x", "win32", none).place).toContain("no system keychain");
});

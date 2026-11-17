import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SERVICE = "wolt-mcp-server";
const ACCOUNT = "wolt-session";

export interface SecretStore {
  /** Where the session lives, in words the user can check. */
  readonly place: string;
  get(): string | undefined;
  set(secret: string): void;
  clear(): void;
}

type Run = (command: string, args: string[], input?: string) => { ok: boolean; out: string };

const run: Run = (command, args, input) => {
  const result = spawnSync(command, args, { input, encoding: "utf8" });
  return { ok: result.status === 0, out: result.stdout?.trim() ?? "" };
};

// `security -i` takes the command on stdin, so the secret never appears in the process list.
const quoted = (text: string): string => `"${text.replace(/(["\\])/g, "\\$1")}"`;

export function macKeychain(exec: Run = run): SecretStore {
  const target = ["-s", SERVICE, "-a", ACCOUNT];
  return {
    place: "macOS Keychain",
    get: () => {
      const found = exec("security", ["find-generic-password", ...target, "-w"]);
      return found.ok && found.out ? found.out : undefined;
    },
    set: (secret) => {
      const saved = exec("security", ["-i"], `add-generic-password -U ${target.join(" ")} -w ${quoted(secret)}\n`);
      if (!saved.ok) throw new Error("the macOS Keychain refused to save the Wolt session");
    },
    clear: () => {
      exec("security", ["delete-generic-password", ...target]);
    },
  };
}

export function linuxSecretService(exec: Run = run): SecretStore {
  const target = ["service", SERVICE, "account", ACCOUNT];
  return {
    place: "system keyring",
    get: () => {
      const found = exec("secret-tool", ["lookup", ...target]);
      return found.ok && found.out ? found.out : undefined;
    },
    set: (secret) => {
      if (!exec("secret-tool", ["store", "--label", "Wolt session (wolt-mcp-server)", ...target], secret).ok) {
        throw new Error("the system keyring refused to save the Wolt session");
      }
    },
    clear: () => {
      exec("secret-tool", ["clear", ...target]);
    },
  };
}

/** Last resort where no keychain exists: a file only this user can read. */
export function fileStore(dir: string): SecretStore {
  const file = join(dir, "session");
  return {
    place: `${file} (no system keychain found; readable only by you)`,
    get: () => (existsSync(file) ? readFileSync(file, "utf8").trim() || undefined : undefined),
    set: (secret) => {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, secret, { mode: 0o600 });
      chmodSync(file, 0o600);
    },
    clear: () => rmSync(file, { force: true }),
  };
}

export function createSecretStore(dir: string, platform: string = process.platform, exec: Run = run): SecretStore {
  if (platform === "darwin") return macKeychain(exec);
  if (platform === "linux" && exec("secret-tool", ["--version"]).ok) return linuxSecretService(exec);
  return fileStore(dir);
}

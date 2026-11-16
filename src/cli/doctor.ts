import { runChecks } from "../checks.js";
import { configDir } from "../platform/paths.js";
import { VERSION } from "../version.js";
import { createContext } from "./serve.js";

export async function doctor(): Promise<void> {
  console.log(`wolt-mcp-server ${VERSION} · node ${process.version} · config ${configDir()}\n`);
  const results = await runChecks(createContext());
  for (const { name, ok, detail } of results) console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`);
  const failed = results.filter((result) => !result.ok).length;
  console.log(
    failed === 0
      ? "\nEverything works."
      : `\n${failed} check(s) failed. Update wolt-mcp-server; if it still fails, Wolt changed its API.`,
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

import { createInterface } from "node:readline/promises";
import { createConfigStore } from "../config.js";
import { mcpClients, resolveLaunch } from "./clients.js";

export async function setup(): Promise<void> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (question: string, fallback: string): Promise<string> =>
    (await prompt.question(`${question} [${fallback}] `)).trim() || fallback;
  const confirm = async (question: string): Promise<boolean> =>
    (await ask(question, "Y")).toLowerCase().startsWith("y");

  try {
    console.log("wolt-mcp-server setup (unofficial, not affiliated with Wolt)\n");
    const launch = resolveLaunch(process.argv[1]);
    const available = mcpClients().filter((client) => client.available());
    if (available.length === 0) console.log("No supported app found (Claude Code, Codex, Cursor, Claude Desktop).");

    for (const client of available) {
      if (!(await confirm(`Add Wolt to ${client.name}?`))) continue;
      try {
        client.install(launch);
        console.log(`  added to ${client.name}`);
      } catch (error) {
        console.log(`  could not add to ${client.name}: ${error instanceof Error ? error.message : error}`);
      }
    }

    const config = createConfigStore();
    const language = await ask("\nLanguage for menus (en, ka, ru, de, fr ...)", config.read().language);
    config.update({ language });

    console.log('\nDone. Restart the app, then ask it: "What can I order on Wolt near <your address>?"');
    console.log("Check the connection any time with: npx wolt-mcp-server doctor");
  } finally {
    prompt.close();
  }
}

#!/usr/bin/env node
import { doctor } from "./doctor.js";
import { serve } from "./serve.js";
import { setup } from "./setup.js";

const commands: Record<string, () => Promise<void>> = { serve, setup, doctor };
const name = process.argv[2] ?? "serve";
const command = commands[name];

if (!command) {
  console.error(`Unknown command "${name}". Use one of: ${Object.keys(commands).join(", ")}.`);
  process.exit(1);
}

await command();

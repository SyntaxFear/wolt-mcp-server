import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { configDir } from "./platform/paths.js";

const terms = z.array(z.string());

const place = z.object({ lat: z.number(), lon: z.number(), label: z.string() });

export const ConfigSchema = z.object({
  language: z.string().default("en"),
  menuLanguage: z.enum(["original", "interface"]).default("original"),
  location: place.optional(),
  places: z.record(z.string(), place).default({}),
  images: z.enum(["always", "on-request", "links"]).default("always"),
  preferences: z
    .object({ allergies: terms, diets: terms, dislikes: terms })
    .default({ allergies: [], diets: [], dislikes: [] }),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface ConfigStore {
  read(): Config;
  update(patch: Partial<Config>): Config;
}

export function createConfigStore(dir: string = configDir()): ConfigStore {
  const file = join(dir, "config.json");
  const read = (): Config => ConfigSchema.parse(existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});
  const update = (patch: Partial<Config>): Config => {
    const next = ConfigSchema.parse({ ...read(), ...patch });
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`);
    return next;
  };
  return { read, update };
}

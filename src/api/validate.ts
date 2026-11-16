import type { z } from "zod";
import { WoltError } from "../errors.js";

export function validate<T>(endpoint: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  throw new WoltError(
    "WOLT_API_CHANGED",
    `Wolt changed the response of ${endpoint} (${issue.path.join(".")}: ${issue.message}).`,
    "Run `npx wolt-mcp-server doctor`, then update wolt-mcp-server to the latest version.",
  );
}

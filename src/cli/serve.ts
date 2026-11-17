import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHttp } from "../api/http.js";
import { createConfigStore } from "../config.js";
import { createServer } from "../server.js";
import type { ToolContext } from "../tools/defineTool.js";

export function createContext(): ToolContext {
  return { http: createHttp(), config: createConfigStore(), fetchImage: fetch, fetchLink: fetch };
}

export async function serve(): Promise<void> {
  await createServer(createContext()).connect(new StdioServerTransport());
}

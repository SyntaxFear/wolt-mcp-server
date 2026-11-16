import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { WoltError } from "../errors.js";
import type { ToolContext, ToolDefinition } from "./defineTool.js";
import { getItem } from "./getItem.js";
import { getMenu } from "./getMenu.js";
import { getVenue } from "./getVenue.js";
import { listVenues } from "./listVenues.js";
import { preferences } from "./preferences.js";
import { search } from "./search.js";
import { searchAddress } from "./searchAddress.js";
import { setLocation } from "./setLocation.js";

export const tools: ToolDefinition[] = [
  searchAddress,
  setLocation,
  search,
  listVenues,
  getVenue,
  getMenu,
  getItem,
  preferences,
];

export async function run(
  tool: ToolDefinition,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<CallToolResult> {
  try {
    const { data, images = [] } = await tool.handler(args, context);
    return { content: [{ type: "text", text: JSON.stringify(data) }, ...images], structuredContent: data };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): CallToolResult {
  const known =
    error instanceof WoltError
      ? error
      : new WoltError(
          "INTERNAL",
          error instanceof Error ? error.message : String(error),
          "Run `npx wolt-mcp-server doctor`.",
        );
  const body = { error: { code: known.code, message: known.message, next_step: known.nextStep } };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(body) }] };
}

export function registerTools(server: McpServer, context: ToolContext): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        outputSchema: tool.output,
        annotations: tool.annotations,
      },
      (args: Record<string, unknown>) => run(tool, args, context),
    );
  }
}

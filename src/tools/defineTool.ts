import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { WoltHttp } from "../api/http.js";
import type { ConfigStore } from "../config.js";
import type { ImageContent } from "../media/images.js";

export interface ToolContext {
  http: WoltHttp;
  config: ConfigStore;
  fetchImage: typeof fetch;
}

export interface ToolResult<Output extends z.ZodRawShape> {
  data: z.infer<z.ZodObject<Output>>;
  images?: ImageContent[];
}

export interface ToolDefinition<
  Input extends z.ZodRawShape = z.ZodRawShape,
  Output extends z.ZodRawShape = z.ZodRawShape,
> {
  name: string;
  title: string;
  description: string;
  input: Input;
  output: Output;
  annotations: ToolAnnotations;
  handler(args: z.infer<z.ZodObject<Input>>, context: ToolContext): Promise<ToolResult<Output>>;
}

export function defineTool<Input extends z.ZodRawShape, Output extends z.ZodRawShape>(
  definition: ToolDefinition<Input, Output>,
): ToolDefinition<Input, Output> {
  return definition;
}

export const READ_WOLT: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };
export const WRITE_LOCAL: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

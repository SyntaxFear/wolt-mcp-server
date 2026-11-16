import { expect, it } from "vitest";
import { z } from "zod";
import { WoltError } from "../../src/errors.js";
import { defineTool } from "../../src/tools/defineTool.js";
import { run, tools } from "../../src/tools/registry.js";
import { testContext } from "../helpers.js";

const base = {
  title: "T",
  description: "d",
  input: { n: z.number() },
  output: { doubled: z.number() },
  annotations: {},
};
const textOf = (result: { content: unknown[] }) => (result.content[0] as { text: string }).text;

it("wraps data as text and structured content, followed by images", async () => {
  const tool = defineTool({
    ...base,
    name: "double",
    handler: async ({ n }) => ({
      data: { doubled: n * 2 },
      images: [{ type: "image", data: "AQID", mimeType: "image/jpeg" }],
    }),
  });
  const result = await run(tool, { n: 2 }, testContext({}));
  expect(result.structuredContent).toEqual({ doubled: 4 });
  expect(result.content).toEqual([
    { type: "text", text: '{"doubled":4}' },
    { type: "image", data: "AQID", mimeType: "image/jpeg" },
  ]);
});

it("turns a WoltError into a coded error result", async () => {
  const tool = defineTool({
    ...base,
    name: "fail",
    handler: async () => {
      throw new WoltError("LOCATION_REQUIRED", "No location.", "Set one.");
    },
  });
  const result = await run(tool, { n: 1 }, testContext({}));
  expect(result.isError).toBe(true);
  expect(JSON.parse(textOf(result))).toEqual({
    error: { code: "LOCATION_REQUIRED", message: "No location.", next_step: "Set one." },
  });
});

it("reports unexpected errors as INTERNAL", async () => {
  const tool = defineTool({
    ...base,
    name: "boom",
    handler: async () => {
      throw new Error("boom");
    },
  });
  expect(textOf(await run(tool, { n: 1 }, testContext({})))).toContain('"code":"INTERNAL"');
});

it("registers uniquely named wolt_ tools", () => {
  const names = tools.map((tool) => tool.name);
  expect(new Set(names).size).toBe(names.length);
  expect(names.every((name) => name.startsWith("wolt_"))).toBe(true);
});

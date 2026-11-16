import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { fixture, testContext } from "./helpers.js";

async function connect(routes: Record<string, unknown>) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" });
  await Promise.all([createServer(testContext(routes)).connect(serverSide), client.connect(clientSide)]);
  return client;
}

it("lists the phase 1 tools with schemas and annotations", async () => {
  const { tools } = await (await connect({})).listTools();
  expect(tools.map((tool) => tool.name).sort()).toEqual([
    "wolt_get_item",
    "wolt_get_menu",
    "wolt_get_venue",
    "wolt_list_venues",
    "wolt_preferences",
    "wolt_search",
    "wolt_search_address",
    "wolt_set_location",
  ]);
  expect(tools.every((tool) => tool.description && tool.outputSchema && tool.annotations)).toBe(true);
});

it("answers a tool call end to end", async () => {
  const client = await connect({ "/v1/pages/restaurants": fixture("pages-restaurants") });
  const result = await client.callTool({ name: "wolt_list_venues", arguments: { limit: 2 } });
  expect((result.structuredContent as { venues: unknown[] }).venues).toHaveLength(2);
});

it("validates a full menu answer against its declared output schema", async () => {
  const client = await connect({ "/static": fixture("venue-static"), "/assortment": fixture("assortment") });
  const result = await client.callTool({
    name: "wolt_get_menu",
    arguments: { venue: "marge-dadiani-1", category: "menucategory-1" },
  });
  expect(result.isError).toBeFalsy();
  expect((result.structuredContent as { dishes: unknown[] }).dishes).toHaveLength(5);
});

it("returns coded errors through the protocol", async () => {
  const client = await connect({});
  const result = await client.callTool({ name: "wolt_get_venue", arguments: { venue: "missing" } });
  expect(result.isError).toBe(true);
  expect(JSON.stringify(result.content)).toContain("NOT_FOUND");
});

it("tells the agent the rules of the server", async () => {
  const client = await connect({});
  expect(client.getInstructions()).toMatch(/unofficial/i);
  expect(client.getInstructions()).toMatch(/untrusted/i);
});

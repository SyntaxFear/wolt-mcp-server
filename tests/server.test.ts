import { statSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { fixture, testContext } from "./helpers.js";

const CARDS = { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } };

async function connect(routes: Record<string, unknown>, capabilities: Record<string, unknown> = {}) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0" }, { capabilities });
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

const menuRoutes = { "/static": fixture("venue-static"), "/assortment": fixture("assortment") };
const menuCall = { name: "wolt_get_menu", arguments: { venue: "marge-dadiani-1" } };

it("points the browsing tools at the card view and serves it as one self-contained page", async () => {
  const client = await connect({});
  const { tools } = await client.listTools();
  const carded = tools.filter((tool) => tool._meta?.ui).map((tool) => tool.name);
  expect(carded.sort()).toEqual(["wolt_get_item", "wolt_get_menu", "wolt_list_venues", "wolt_search"]);
  const { contents } = await client.readResource({ uri: "ui://wolt/cards.html" });
  const page = contents[0] as { mimeType: string; text: string };
  expect(page.mimeType).toBe("text/html;profile=mcp-app");
  expect(page.text).toContain("ui/notifications/tool-result");
  expect(page.text).not.toMatch(/<script[^>]+src=|<link[^>]+href=|innerHTML/);
});

it("gives apps without card support one picture file holding the whole answer", async () => {
  const result = await (await connect(menuRoutes)).callTool(menuCall);
  const { picture_sheet } = result.structuredContent as { picture_sheet?: string };
  expect(picture_sheet).toMatch(/wolt-[0-9a-f]{12}\.jpg$/);
  expect(statSync(picture_sheet as string).size).toBeGreaterThan(1000);
});

it("leaves the picture file out for apps that draw the cards", async () => {
  const result = await (await connect(menuRoutes, CARDS)).callTool(menuCall);
  expect((result.structuredContent as { picture_sheet?: string }).picture_sheet).toBeUndefined();
});

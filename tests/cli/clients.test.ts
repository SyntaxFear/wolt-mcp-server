import { describe, expect, it } from "vitest";
import { mergeServerEntry, resolveLaunch } from "../../src/cli/clients.js";

describe("resolveLaunch", () => {
  it("uses node and the script path for a local checkout", () => {
    expect(resolveLaunch("/home/me/WoltMCP/dist/cli/index.js", "linux", "/usr/bin/node")).toEqual({
      command: "/usr/bin/node",
      args: ["/home/me/WoltMCP/dist/cli/index.js"],
    });
  });

  it("uses npx for an installed package", () => {
    expect(resolveLaunch("/x/node_modules/wolt-mcp-server/dist/cli/index.js", "darwin", "node")).toEqual({
      command: "npx",
      args: ["-y", "wolt-mcp-server"],
    });
  });

  it("wraps npx in cmd on Windows", () => {
    expect(resolveLaunch("C:\\x\\node_modules\\wolt-mcp-server\\dist\\cli\\index.js", "win32", "node")).toEqual({
      command: "cmd",
      args: ["/c", "npx", "-y", "wolt-mcp-server"],
    });
  });
});

describe("mergeServerEntry", () => {
  const launch = { command: "npx", args: ["-y", "wolt-mcp-server"] };

  it("creates a config when none exists", () => {
    expect(JSON.parse(mergeServerEntry(undefined, launch))).toEqual({ mcpServers: { wolt: launch } });
  });

  it("keeps other servers and settings", () => {
    const existing = JSON.stringify({ theme: "dark", mcpServers: { other: { command: "x", args: [] } } });
    expect(JSON.parse(mergeServerEntry(existing, launch))).toEqual({
      theme: "dark",
      mcpServers: { other: { command: "x", args: [] }, wolt: launch },
    });
  });
});

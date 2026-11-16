import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createConfigStore } from "../src/config.js";
import { configDir } from "../src/platform/paths.js";

const tempDir = () => mkdtempSync(join(tmpdir(), "wolt-mcp-"));

describe("config store", () => {
  it("returns defaults when no file exists", () => {
    expect(createConfigStore(tempDir()).read()).toEqual({
      language: "en",
      images: "always",
      preferences: { allergies: [], diets: [], dislikes: [] },
    });
  });

  it("persists updates", () => {
    const dir = tempDir();
    createConfigStore(dir).update({ location: { lat: 41.7, lon: 44.8, label: "Home" } });
    expect(createConfigStore(dir).read().location).toEqual({ lat: 41.7, lon: 44.8, label: "Home" });
  });
});

describe("configDir", () => {
  it("honours WOLT_MCP_HOME", () => {
    expect(configDir({ WOLT_MCP_HOME: "/custom" }, "linux")).toBe("/custom");
  });

  it("uses APPDATA on Windows", () => {
    expect(configDir({ APPDATA: "C:\\Users\\a\\AppData\\Roaming" }, "win32")).toContain("wolt-mcp");
  });
});

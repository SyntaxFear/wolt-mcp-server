import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validate } from "../../src/api/validate.js";
import { WoltError } from "../../src/errors.js";

const schema = z.object({ venue: z.object({ slug: z.string() }) });

describe("validate", () => {
  it("returns parsed data and drops unknown fields", () => {
    expect(validate("/x", schema, { venue: { slug: "a", extra: 1 }, other: true })).toEqual({ venue: { slug: "a" } });
  });

  it("raises WOLT_API_CHANGED naming the endpoint and field", () => {
    const run = () => validate("/v1/pages/restaurants", schema, { venue: {} });
    expect(run).toThrowError(WoltError);
    expect(run).toThrowError(/\/v1\/pages\/restaurants.*venue\.slug/);
    try {
      run();
    } catch (error) {
      expect((error as WoltError).code).toBe("WOLT_API_CHANGED");
    }
  });
});

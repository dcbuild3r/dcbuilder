import { describe, expect, test } from "bun:test";
import { parseNaturalQuery } from "../src/nl.ts";

describe("parseNaturalQuery", () => {
  test("turns common news phrases into structured filters", () => {
    expect(parseNaturalQuery("news from the last week")).toEqual({
      resource: "news",
      filters: { since: "7d" },
    });
    expect(parseNaturalQuery("news from the last day")).toEqual({
      resource: "news",
      filters: { since: "1d" },
    });
  });

  test("turns matching phrases into text filters without sending prompts to the API", () => {
    expect(parseNaturalQuery("candidates matching senior zk engineer in europe")).toEqual({
      resource: "candidates",
      filters: { q: "senior zk engineer in europe" },
    });
    expect(parseNaturalQuery("jobs matching rust protocol engineer remote")).toEqual({
      resource: "jobs",
      filters: { q: "rust protocol engineer remote" },
    });
  });
});

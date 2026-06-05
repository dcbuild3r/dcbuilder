import { describe, expect, test } from "bun:test";
import { parseNaturalQuery } from "../src/query-parser.ts";

describe("parseNaturalQuery", () => {
  test("converts natural language into structured filters without prompt fields", () => {
    const parsed = parseNaturalQuery("remote zk jobs in Prague limit 5");

    expect(parsed).toEqual({
      resource: "jobs",
      filters: {
        query: "zk",
        location: "Prague",
        limit: 5,
        remote: true,
      },
    });
    expect(JSON.stringify(parsed)).not.toContain("prompt");
  });

  test("keeps unknown text as a deterministic search filter", () => {
    expect(parseNaturalQuery("latest portfolio news")).toEqual({
      resource: "news",
      filters: { query: "latest portfolio" },
    });
  });
});

import { describe, expect, test } from "bun:test";
import { formatOutput } from "../src/format.ts";

const rows = [
  { id: "1", title: "First", score: 10 },
  { id: "2", title: "Second", score: 7 },
];

describe("formatOutput", () => {
  test("defaults to stable pretty JSON", () => {
    expect(formatOutput({ items: rows }, "json")).toBe(
      `${JSON.stringify({ items: rows }, null, 2)}\n`,
    );
  });

  test("renders compact tables for arrays or item collections", () => {
    const output = formatOutput({ items: rows }, "table", { columns: 80 });

    expect(output).toContain("┌");
    expect(output).toContain("title");
    expect(output).toContain("score");
    expect(output).toContain("First");
  });

  test("renders backend data envelopes as rows", () => {
    expect(formatOutput({ data: rows, meta: { limit: 2 } }, "table", { columns: 80 })).toContain(
      "Second",
    );
    expect(formatOutput({ data: rows, meta: { limit: 2 } }, "markdown")).toContain(
      "| 2 | Second | 7 |",
    );
  });

  test("renders readable news tables without noisy fields", () => {
    const longDescription =
      "Variant announces Variant 4, a $222M venture fund focused on autonomy: technology that expands user agency through new markets, infrastructure, and applications.";
    const output = formatOutput(
      {
        data: [
          {
            id: "hn41pbdo254034u78pngq8vi",
            title: "VARIANT 4: AUTONOMY",
            url: "https://x.com/jessewldn/status/2062150761727848850",
            source: "Jesse Walden",
            sourceImage: "https://example.com/avatar.jpg",
            date: "2026-06-03T00:00:00.000Z",
            description: longDescription,
            category: "x_post",
            featured: false,
            relevance: 5,
            createdAt: "2026-06-03T14:02:16.465Z",
            updatedAt: "2026-06-03T14:02:16.465Z",
            type: "curated",
          },
        ],
      },
      "table",
      { columns: 96 },
    );

    expect(output).toContain("title");
    expect(output).toContain("source");
    expect(output).toContain("category");
    expect(output).toContain("date");
    expect(output).toContain("description");
    expect(output).toContain("2026-06-03");
    expect(output).not.toContain("sourceImage");
    expect(output).not.toContain("createdAt");
    expect(output).not.toContain("updatedAt");
    expect(output).not.toContain("https://x.com");
    for (const line of output.trimEnd().split("\n")) {
      expect(line.length).toBeLessThanOrEqual(110);
    }
  });

  test("renders markdown tables", () => {
    expect(formatOutput({ items: rows }, "markdown")).toContain(
      "| id | title | score |",
    );
    expect(formatOutput({ items: rows }, "markdown")).toContain(
      "| 1 | First | 10 |",
    );
  });
});

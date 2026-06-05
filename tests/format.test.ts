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
    expect(formatOutput({ items: rows }, "table")).toContain(
      "id  title   score",
    );
    expect(formatOutput({ items: rows }, "table")).toContain("1   First   10");
  });

  test("renders backend data envelopes as rows", () => {
    expect(formatOutput({ data: rows, meta: { limit: 2 } }, "table")).toContain(
      "id  title   score",
    );
    expect(formatOutput({ data: rows, meta: { limit: 2 } }, "markdown")).toContain(
      "| 2 | Second | 7 |",
    );
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

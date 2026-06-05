import type { Format } from "./types.ts";

export function formatOutput(value: unknown, format: Format = "json"): string {
  if (format === "json") return `${JSON.stringify(value, null, 2)}\n`;

  const rows = extractRows(value);
  if (format === "markdown") return formatMarkdown(rows);
  return formatTable(rows);
}

function extractRows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.map(toRow);
  if (isRecord(value) && Array.isArray(value.items)) {
    return value.items.map(toRow);
  }
  if (isRecord(value) && Array.isArray(value.data)) {
    return value.data.map(toRow);
  }
  return [toRow(value)];
}

function toRow(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : { value };
}

function formatTable(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "\n";

  const headers = collectHeaders(rows);
  const widths = headers.map((header) =>
    Math.max(header.length, ...rows.map((row) => stringifyCell(row[header]).length)),
  );
  const lines = [
    headers.map((header, index) => header.padEnd(widths[index])).join("  "),
    ...rows.map((row) =>
      headers
        .map((header, index) => stringifyCell(row[header]).padEnd(widths[index]))
        .join("  "),
    ),
  ];

  return `${lines.join("\n")}\n`;
}

function formatMarkdown(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "\n";

  const headers = collectHeaders(rows);
  const divider = headers.map(() => "---");
  const lines = [
    markdownRow(headers),
    markdownRow(divider),
    ...rows.map((row) => markdownRow(headers.map((header) => stringifyCell(row[header])))),
  ];

  return `${lines.join("\n")}\n`;
}

function markdownRow(cells: string[]): string {
  return `| ${cells.map(escapeMarkdownCell).join(" | ")} |`;
}

function collectHeaders(rows: Record<string, unknown>[]): string[] {
  const headers = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) headers.add(key);
  }
  return [...headers];
}

function stringifyCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

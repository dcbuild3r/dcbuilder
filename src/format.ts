import Table from "cli-table3";
import type { Format } from "./types.ts";

export type FormatOptions = {
  columns?: number;
};

const NOISY_TABLE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "sourceImage",
  "relevance",
  "featured",
]);

const NEWS_TABLE_HEADERS = ["title", "source", "category", "date", "description"];

const GENERIC_TABLE_HEADER_PRIORITY = [
  "id",
  "status",
  "kind",
  "title",
  "name",
  "company",
  "role",
  "source",
  "location",
  "remote",
  "category",
  "availability",
  "date",
  "description",
  "summary",
  "score",
];

export function formatOutput(
  value: unknown,
  format: Format = "json",
  options: FormatOptions = {},
): string {
  if (format === "json") return `${JSON.stringify(value, null, 2)}\n`;

  const rows = extractRows(value);
  if (format === "markdown") return formatMarkdown(rows);
  return formatTable(rows, options);
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

function formatTable(rows: Record<string, unknown>[], options: FormatOptions): string {
  if (rows.length === 0) return "\n";

  const headers = selectTableHeaders(rows);
  const tableWidth = Math.max(64, Math.min(options.columns ?? process.stdout.columns ?? 120, 180));
  const colWidths = calculateColumnWidths(headers, tableWidth);
  const table = new Table({
    head: headers,
    colWidths,
    wordWrap: true,
    wrapOnWordBoundary: true,
    style: {
      compact: false,
      head: [],
      border: [],
      "padding-left": 1,
      "padding-right": 1,
    },
  });

  for (const row of rows) {
    table.push(headers.map((header) => stringifyTableCell(row[header], header)));
  }

  return `${table.toString()}\n`;
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

function selectTableHeaders(rows: Record<string, unknown>[]): string[] {
  const headers = collectHeaders(rows);
  if (isNewsShape(headers)) return NEWS_TABLE_HEADERS.filter((header) => headers.includes(header));

  const usefulHeaders = headers.filter((header) => !NOISY_TABLE_FIELDS.has(header));
  const prioritizedHeaders = GENERIC_TABLE_HEADER_PRIORITY.filter((header) =>
    usefulHeaders.includes(header),
  );
  const extraHeaders = usefulHeaders.filter((header) => !prioritizedHeaders.includes(header));
  const selectedHeaders = [...prioritizedHeaders, ...extraHeaders].slice(0, 6);

  return selectedHeaders.length > 0 ? selectedHeaders : headers.slice(0, 6);
}

function isNewsShape(headers: string[]): boolean {
  return (
    headers.includes("source") &&
    headers.includes("category") &&
    headers.includes("date") &&
    headers.includes("description")
  );
}

function calculateColumnWidths(headers: string[], tableWidth: number): number[] {
  const borderWidth = headers.length + 1;
  const availableWidth = Math.max(40, tableWidth - borderWidth);

  if (headers.length === 1) return [availableWidth];

  const preferred = headers.map((header) => preferredColumnWidth(header, availableWidth));
  const minimums = headers.map((header) => minimumColumnWidth(header));
  const preferredTotal = preferred.reduce((sum, width) => sum + width, 0);

  if (preferredTotal <= availableWidth) {
    const widths = [...preferred];
    widths[widths.length - 1] += availableWidth - preferredTotal;
    return widths;
  }

  const minimumTotal = minimums.reduce((sum, width) => sum + width, 0);
  if (minimumTotal >= availableWidth) {
    const shared = Math.max(8, Math.floor(availableWidth / headers.length));
    return headers.map((_, index) =>
      index === headers.length - 1 ? availableWidth - shared * (headers.length - 1) : shared,
    );
  }

  const widths = [...minimums];
  let remaining = availableWidth - minimumTotal;
  while (remaining > 0) {
    let changed = false;
    for (let index = 0; index < headers.length && remaining > 0; index += 1) {
      if (widths[index] >= preferred[index]) continue;
      widths[index] += 1;
      remaining -= 1;
      changed = true;
    }
    if (!changed) break;
  }
  return widths;
}

function preferredColumnWidth(header: string, availableWidth: number): number {
  if (header === "description" || header === "summary") {
    return Math.max(28, Math.floor(availableWidth * 0.38));
  }
  if (header === "title" || header === "name") return Math.max(22, Math.floor(availableWidth * 0.24));
  if (header === "id") return 16;
  if (header === "date") return 12;
  if (header === "remote") return 10;
  return 14;
}

function minimumColumnWidth(header: string): number {
  if (header === "description" || header === "summary") return 24;
  if (header === "title" || header === "name") return 18;
  if (header === "id") return 10;
  if (header === "date") return 12;
  return Math.max(8, header.length + 2);
}

function stringifyTableCell(value: unknown, header: string): string {
  if (value === undefined || value === null) return "";
  if (header === "date" && typeof value === "string") return formatDateCell(value);
  if (Array.isArray(value)) return value.map((item) => stringifyCell(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDateCell(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
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

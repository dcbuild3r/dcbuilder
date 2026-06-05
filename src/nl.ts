import type { Filters, QueryDsl, Resource } from "./types.ts";

const RESOURCES: Resource[] = ["news", "jobs", "candidates"];

export function parseNaturalQuery(input: string): QueryDsl {
  let text = normalize(input);
  const resource = detectResource(text);
  const filters: Filters = {};

  const since = parseSince(text);
  if (since) {
    filters.since = since.value;
    text = normalize(text.replace(since.match, " "));
  }

  const matching = text.match(/\bmatching\s+(.+)$/i);
  if (matching) {
    return {
      resource,
      filters: { ...filters, q: matching[1].trim() },
    };
  }

  const limit = text.match(/\blimit\s+(\d+)\b/i);
  if (limit) {
    filters.limit = Number(limit[1]);
    text = normalize(text.replace(limit[0], " "));
  }

  if (/\bremote\b/i.test(text)) {
    filters.remote = true;
    text = normalize(text.replace(/\bremote\b/gi, " "));
  }

  const location = text.match(/\bin\s+([a-z][a-z\s.-]+)$/i);
  if (location) {
    filters.location = titleCase(location[1].trim());
    text = normalize(text.slice(0, location.index));
  }

  for (const candidate of RESOURCES) {
    text = normalize(text.replace(new RegExp(`\\b${candidate}\\b`, "gi"), " "));
  }

  if (text) {
    filters.query = text;
  }

  return { resource, filters };
}

function detectResource(text: string): Resource | undefined {
  const lowered = text.toLowerCase();
  return RESOURCES.find((resource) => lowered.includes(resource));
}

function parseSince(text: string): { match: string; value: string } | undefined {
  const match = text.match(/\bfrom\s+the\s+last\s+(day|week)\b/i);
  if (!match) return undefined;

  return {
    match: match[0],
    value: match[1].toLowerCase() === "day" ? "1d" : "7d",
  };
}

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

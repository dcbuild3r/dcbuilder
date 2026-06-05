import { ApiError, DcbuilderApiClient } from "./api-client.ts";
import type { FetchLike } from "./api-client.ts";
import { resolveApiUrl, resolveCredentials } from "./config.ts";
import { formatOutput } from "./format.ts";
import { parseNaturalQuery } from "./nl.ts";
import type {
  Env,
  Filters,
  Format,
  InboxAction,
  JsonObject,
  QueryResource,
  QueryDsl,
  SubmitKind,
} from "./types.ts";

type CliOptions = {
  env?: Env;
  fetch?: FetchLike;
};

type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type ParsedArgs = {
  format: Format;
  positional: string[];
  options: Record<string, string[]>;
  flags: Set<string>;
};

export async function runCli(argv: string[], options: CliOptions = {}): Promise<CliResult> {
  try {
    const parsed = parseArgs(argv);
    if (isHelpCommand(parsed)) {
      return {
        exitCode: 0,
        stdout: formatOutput(usage(), parsed.format),
        stderr: "",
      };
    }

    const credentials = resolveCliCredentials(parsed, options.env);
    const client = new DcbuilderApiClient(credentials, { fetch: options.fetch });
    const data = await dispatch(parsed, client);

    return {
      exitCode: 0,
      stdout: formatOutput(data, parsed.format),
      stderr: "",
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${formatError(error)}\n`,
    };
  }
}

async function dispatch(parsed: ParsedArgs, client: DcbuilderApiClient): Promise<unknown> {
  const [command, subcommand, id, ...rest] = parsed.positional;
  const filters = parseFilters(parsed);

  switch (command) {
    case "schema":
      return client.schema();
    case "news":
      return client.news(filters);
    case "jobs":
      return client.jobs(filters);
    case "candidates":
      return client.candidates(filters);
    case "query":
      return client.query(parseQuery(parsed));
    case "inbox":
      return dispatchInbox(subcommand, id, rest, parsed, client);
    case "submit":
      return dispatchSubmit(subcommand, rest, parsed, client);
    case "invites":
      return dispatchInvites(subcommand, rest, parsed, client);
    case "search":
      return dispatchSearch(subcommand, rest, parsed, client);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function dispatchInbox(
  subcommand: string | undefined,
  id: string | undefined,
  rest: string[],
  parsed: ParsedArgs,
  client: DcbuilderApiClient,
): Promise<unknown> {
  switch (subcommand) {
    case "list":
    case undefined:
      return client.inboxList(parseFilters(parsed));
    case "show":
      assertValue(id, "inbox show requires an id");
      return client.inboxShow(id);
    case "comment":
      assertValue(id, "inbox comment requires an id");
      return client.inboxComment(id, parseComment(rest, parsed));
    case "approve":
    case "reject":
      assertValue(id, `inbox ${subcommand} requires an id`);
      return client.inboxAction(id, subcommand satisfies InboxAction, parseJsonPayload(parsed));
    default:
      throw new Error(`Unknown inbox command: ${subcommand}`);
  }
}

function dispatchSubmit(
  kind: string | undefined,
  rest: string[],
  parsed: ParsedArgs,
  client: DcbuilderApiClient,
): Promise<unknown> {
  if (!isSubmitKind(kind)) {
    throw new Error("submit requires one of: job, candidate, message");
  }

  const payload = parseJsonPayload(parsed, rest);
  return client.submit(kind, payload);
}

function resolveCliCredentials(parsed: ParsedArgs, env: Env | undefined) {
  if (isPublicMessageSubmission(parsed) && !env?.DCBUILDER_API_TOKEN?.trim()) {
    return { apiUrl: resolveApiUrl(env) };
  }

  return resolveCredentials(env);
}

function isPublicMessageSubmission(parsed: ParsedArgs): boolean {
  return parsed.positional[0] === "submit" && parsed.positional[1] === "message";
}

function dispatchInvites(
  subcommand: string | undefined,
  rest: string[],
  parsed: ParsedArgs,
  client: DcbuilderApiClient,
): Promise<unknown> {
  if (subcommand !== "create") {
    throw new Error("invites requires command: create");
  }
  return client.createInvite(parseJsonPayload(parsed, rest));
}

function dispatchSearch(
  subcommand: string | undefined,
  rest: string[],
  parsed: ParsedArgs,
  client: DcbuilderApiClient,
): Promise<unknown> {
  if (subcommand !== "refresh") {
    throw new Error("search requires command: refresh");
  }
  return client.refreshSearch(parseJsonPayload(parsed, rest));
}

function parseQuery(parsed: ParsedArgs): QueryDsl {
  const json = first(parsed.options.json) ?? first(parsed.options.payload);
  if (json) return JSON.parse(json) as QueryDsl;

  const resource = first(parsed.options.resource);
  const filters = parseFilters(parsed);
  const text = parsed.positional.slice(1).join(" ").trim();

  if (text) {
    return parseNaturalQuery(text);
  }

  return {
    resource: isQueryResource(resource) ? resource : undefined,
    filters,
  };
}

function parseFilters(parsed: ParsedArgs): Filters {
  const filters: Filters = {};
  const limit = first(parsed.options.limit);
  const offset = first(parsed.options.offset);
  const location = first(parsed.options.location);
  const query = first(parsed.options.q) ?? first(parsed.options.query);
  const since = first(parsed.options.since);
  const company = first(parsed.options.company);
  const category = first(parsed.options.category);
  const availability = first(parsed.options.availability);
  const status = first(parsed.options.status);
  const kind = first(parsed.options.kind);
  const tags = parsed.options.tag ?? parsed.options.tags;

  if (limit !== undefined) filters.limit = Number(limit);
  if (offset !== undefined) filters.offset = Number(offset);
  if (location) filters.location = location;
  if (query) filters.query = query;
  if (since) filters.since = since;
  if (company) filters.company = company;
  if (category) filters.category = category;
  if (availability) filters.availability = availability;
  if (status) filters.status = status;
  if (kind) filters.kind = kind;
  if (tags?.length) filters.tags = tags;
  if (parsed.flags.has("remote")) filters.remote = true;

  return filters;
}

function parseJsonPayload(parsed: ParsedArgs, fallbackText: string[] = []): JsonObject {
  const json = first(parsed.options.json) ?? first(parsed.options.payload);
  if (json) return JSON.parse(json) as JsonObject;

  const text = fallbackText.join(" ").trim();
  return text ? { text } : {};
}

function parseComment(rest: string[], parsed: ParsedArgs): string | JsonObject {
  const payload = parseJsonPayload(parsed, rest);
  if (typeof payload.body === "string") return payload;
  if (typeof payload.text === "string") return payload.text;
  return rest.join(" ").trim();
}

function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const options: Record<string, string[]> = {};
  const flags = new Set<string>();
  let format: Format = "json";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [rawName, inlineValue] = arg.slice(2).split("=", 2);
    const name = camelToKebab(rawName);
    if (name === "format") {
      const value = inlineValue ?? argv[++index];
      if (!isFormat(value)) throw new Error("--format must be json, table, or markdown");
      format = value;
      continue;
    }

    if (name === "remote") {
      flags.add(name);
      continue;
    }

    const value = inlineValue ?? argv[++index];
    if (value === undefined) throw new Error(`--${name} requires a value`);
    options[name] = [...(options[name] ?? []), value];
  }

  return { format, positional, options, flags };
}

function usage(): JsonObject {
  return {
    commands: [
      "schema",
      "news",
      "jobs",
      "candidates",
      "query",
      "inbox list",
      "inbox show <id>",
      "inbox comment <id>",
      "inbox approve <id>",
      "inbox reject <id>",
      "submit job",
      "submit candidate",
      "submit message",
      "invites create",
      "search refresh",
    ],
    credentials: ["DCBUILDER_API_URL", "DCBUILDER_API_TOKEN"],
  };
}

function first(values: string[] | undefined): string | undefined {
  return values?.[0];
}

function assertValue(value: string | undefined, message: string): asserts value is string {
  if (!value) throw new Error(message);
}

function isFormat(value: string | undefined): value is Format {
  return value === "json" || value === "table" || value === "markdown";
}

function isQueryResource(value: string | undefined): value is QueryResource {
  return (
    value === "news" ||
    value === "jobs" ||
    value === "candidates" ||
    value === "investments" ||
    value === "blog" ||
    value === "affiliations"
  );
}

function isSubmitKind(value: string | undefined): value is SubmitKind {
  return value === "job" || value === "candidate" || value === "message";
}

function isHelpCommand(parsed: ParsedArgs): boolean {
  const command = parsed.positional[0];
  return command === undefined || command === "help" || command === "--help" || command === "-h";
}

function camelToKebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    const retry = error.retryAfter ? ` retry-after=${error.retryAfter}` : "";
    return `API ${error.status}: ${error.message}${retry}`;
  }

  if (error instanceof Error) return error.message;
  return String(error);
}

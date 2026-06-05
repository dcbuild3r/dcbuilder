import type { DcbuilderApiClient } from "../api-client.ts";
import type { Filters, JsonObject } from "../types.ts";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonObject;
};

export type McpToolResponse = {
  content: Array<{ type: "text"; text: string }>;
};

type ToolHandler = (args: JsonObject) => Promise<unknown>;

export function createMcpToolRegistry(client: DcbuilderApiClient): {
  tools: McpToolDefinition[];
  handle(name: string, args?: JsonObject): Promise<McpToolResponse>;
} {
  const handlers = new Map<string, ToolHandler>();

  const tools: McpToolDefinition[] = [
    tool("dcbuilder_news", "Read redacted news from dcbuilder.dev.", filterSchema(), (args) =>
      client.news(args as Filters),
    ),
    tool("dcbuilder_jobs", "Read redacted jobs from dcbuilder.dev.", filterSchema(), (args) =>
      client.jobs(args as Filters),
    ),
    tool(
      "dcbuilder_candidates",
      "Read redacted candidates from dcbuilder.dev.",
      filterSchema(),
      (args) => client.candidates(args as Filters),
    ),
    tool(
      "dcbuilder_query",
      "Run an allowlisted query DSL against dcbuilder.dev.",
      querySchema(),
      (args) => client.query(args as never),
    ),
    tool("dcbuilder_submit_job", "Create a job inbox submission.", payloadSchema(), (args) =>
      client.submit("job", args),
    ),
    tool(
      "dcbuilder_submit_candidate",
      "Create a candidate inbox submission.",
      payloadSchema(),
      (args) => client.submit("candidate", args),
    ),
    tool(
      "dcbuilder_submit_message",
      "Create a message inbox submission.",
      payloadSchema(),
      (args) => client.submit("message", args),
    ),
    tool("dcbuilder_inbox_list", "List inbox submissions.", filterSchema(), (args) =>
      client.inboxList(args as Filters),
    ),
    tool("dcbuilder_inbox_show", "Show an inbox submission.", idSchema(), (args) =>
      client.inboxShow(String(args.id)),
    ),
    tool("dcbuilder_inbox_comment", "Comment on an inbox submission.", commentSchema(), (args) =>
      client.inboxComment(String(args.id), String(args.body)),
    ),
    tool("dcbuilder_inbox_approve", "Approve an inbox submission.", approveSchema(), (args) =>
      client.inboxAction(String(args.id), "approve", payloadOrEmpty(args.payload)),
    ),
    tool("dcbuilder_inbox_reject", "Reject an inbox submission.", rejectSchema(), (args) =>
      client.inboxAction(String(args.id), "reject", rejectPayload(args)),
    ),
    tool("dcbuilder_create_invite", "Create a scoped submit-token invite.", payloadSchema(), (args) =>
      client.createInvite(args),
    ),
    tool("dcbuilder_refresh_search", "Refresh semantic-search snapshots.", payloadSchema(), (args) =>
      client.refreshSearch(args),
    ),
    tool("dcbuilder_schema", "Fetch OpenAPI/schema metadata.", emptySchema(), () => client.schema()),
  ];

  for (const definition of tools) {
    const handler = (definition as McpToolDefinition & { handler: ToolHandler }).handler;
    handlers.set(definition.name, handler);
    delete (definition as Partial<McpToolDefinition & { handler: ToolHandler }>).handler;
  }

  return {
    tools,
    async handle(name, args = {}) {
      const handler = handlers.get(name);
      if (!handler) throw new Error(`Unknown MCP tool: ${name}`);
      const result = await handler(args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  };
}

function tool(
  name: string,
  description: string,
  inputSchema: JsonObject,
  handler: ToolHandler,
): McpToolDefinition & { handler: ToolHandler } {
  return { name, description, inputSchema, handler };
}

function emptySchema(): JsonObject {
  return { type: "object", additionalProperties: false, properties: {} };
}

function filterSchema(): JsonObject {
  return {
    type: "object",
    additionalProperties: true,
    properties: {
      limit: { type: "number" },
      offset: { type: "number" },
      query: { type: "string" },
      q: { type: "string" },
      company: { type: "string" },
      category: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      tag: { type: "array", items: { type: "string" } },
      location: { type: "string" },
      availability: { type: "string" },
      status: { type: "string" },
      kind: { type: "string" },
      remote: { type: "boolean" },
      since: { type: "string" },
    },
  };
}

function querySchema(): JsonObject {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      table: { enum: ["news", "jobs", "candidates", "investments", "blog", "affiliations"] },
      resource: { enum: ["news", "jobs", "candidates", "investments", "blog", "affiliations"] },
      filters: { type: "object", additionalProperties: true },
      where: { type: "array", items: { type: "object", additionalProperties: true } },
      select: { type: "array", items: { type: "string" } },
      orderBy: { type: "string" },
    },
  };
}

function payloadSchema(): JsonObject {
  return { type: "object", additionalProperties: true, properties: {} };
}

function idSchema(): JsonObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: { id: { type: "string" } },
  };
}

function commentSchema(): JsonObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "body"],
    properties: {
      id: { type: "string" },
      body: { type: "string" },
    },
  };
}

function approveSchema(): JsonObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: {
      id: { type: "string" },
      payload: { type: "object", additionalProperties: true },
    },
  };
}

function rejectSchema(): JsonObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id"],
    properties: {
      id: { type: "string" },
      reason: { type: "string" },
      payload: { type: "object", additionalProperties: true },
    },
  };
}

function rejectPayload(args: JsonObject): JsonObject {
  if (isRecord(args.payload)) return args.payload as JsonObject;
  if (typeof args.reason === "string") return { reason: args.reason };
  return {};
}

function payloadOrEmpty(value: unknown): JsonObject {
  return isRecord(value) ? (value as JsonObject) : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DcbuilderApiClient } from "../api-client.ts";
import { resolveCredentials } from "../config.ts";
import { createMcpToolRegistry } from "./tools.ts";
import type { Env, JsonObject } from "../types.ts";

export async function runMcpServer(env: Env = Bun.env): Promise<void> {
  const client = new DcbuilderApiClient(resolveCredentials(env));
  const registry = createMcpToolRegistry(client);
  const server = new McpServer({
    name: "dcbuilder",
    version: "0.0.0",
  });
  const registerTool = server.registerTool.bind(server) as (
    name: string,
    config: { description: string; inputSchema: unknown },
    handler: (args: unknown) => Promise<unknown>,
  ) => unknown;

  for (const tool of registry.tools) {
    registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: zodInputSchema(tool.name),
      },
      async (args: unknown) => registry.handle(tool.name, args as JsonObject),
    );
  }

  await server.connect(new StdioServerTransport());
}

function zodInputSchema(name: string): Record<string, z.ZodTypeAny> | z.ZodTypeAny {
  if (name === "dcbuilder_schema") return {};
  if (name === "dcbuilder_query") {
    return {
      table: z.enum(["news", "jobs", "candidates", "investments", "blog", "affiliations"]).optional(),
      resource: z.enum(["news", "jobs", "candidates", "investments", "blog", "affiliations"]).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
      where: z.array(z.record(z.string(), z.unknown())).optional(),
      select: z.array(z.string()).optional(),
      orderBy: z.string().optional(),
    };
  }
  if (
    name === "dcbuilder_submit_job" ||
    name === "dcbuilder_submit_candidate" ||
    name === "dcbuilder_submit_message" ||
    name === "dcbuilder_create_invite" ||
    name === "dcbuilder_refresh_search"
  ) {
    return z.record(z.string(), z.unknown());
  }
  if (name === "dcbuilder_inbox_show") {
    return { id: z.string() };
  }
  if (name === "dcbuilder_inbox_comment") {
    return { id: z.string(), body: z.string() };
  }
  if (name === "dcbuilder_inbox_approve") {
    return {
      id: z.string(),
      payload: z.record(z.string(), z.unknown()).optional(),
    };
  }
  if (name === "dcbuilder_inbox_reject") {
    return {
      id: z.string(),
      reason: z.string().optional(),
      payload: z.record(z.string(), z.unknown()).optional(),
    };
  }

  return {
    limit: z.number().optional(),
    offset: z.number().optional(),
    query: z.string().optional(),
    q: z.string().optional(),
    company: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    tag: z.array(z.string()).optional(),
    location: z.string().optional(),
    availability: z.string().optional(),
    status: z.string().optional(),
    kind: z.string().optional(),
    remote: z.boolean().optional(),
    since: z.string().optional(),
  };
}

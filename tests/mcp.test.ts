import { describe, expect, test } from "bun:test";
import { createMcpToolRegistry } from "../src/mcp/tools.ts";

describe("createMcpToolRegistry", () => {
  test("exposes typed tools for reads, schema, query, submit, and inbox workflow", () => {
    const registry = createMcpToolRegistry({} as never);
    const names = registry.tools.map((tool) => tool.name).sort();

    expect(names).toEqual([
      "dcbuilder_candidates",
      "dcbuilder_create_invite",
      "dcbuilder_inbox_approve",
      "dcbuilder_inbox_comment",
      "dcbuilder_inbox_list",
      "dcbuilder_inbox_reject",
      "dcbuilder_inbox_show",
      "dcbuilder_jobs",
      "dcbuilder_news",
      "dcbuilder_query",
      "dcbuilder_refresh_search",
      "dcbuilder_schema",
      "dcbuilder_submit_candidate",
      "dcbuilder_submit_job",
      "dcbuilder_submit_message",
    ]);
    expect(
      registry.tools.find((tool) => tool.name === "dcbuilder_query")
        ?.inputSchema,
    ).toMatchObject({
      type: "object",
      properties: {
        resource: {
          enum: ["news", "jobs", "candidates", "investments", "blog", "affiliations"],
        },
        filters: { type: "object" },
        where: { type: "array" },
      },
    });
  });

  test("handlers return MCP text content with JSON payloads", async () => {
    const registry = createMcpToolRegistry({
      jobs: async (filters: unknown) => ({ filters, items: [{ id: "job_1" }] }),
    } as never);

    const response = await registry.handle("dcbuilder_jobs", { limit: 1 });

    expect(response).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { filters: { limit: 1 }, items: [{ id: "job_1" }] },
            null,
            2,
          ),
        },
      ],
    });
  });

  test("routes MCP invite, search, and dedicated submit handlers", async () => {
    const calls: unknown[] = [];
    const registry = createMcpToolRegistry({
      createInvite: async (payload: unknown) => {
        calls.push(["invite", payload]);
        return { data: { token: "backend-token" } };
      },
      refreshSearch: async (payload: unknown) => {
        calls.push(["search", payload]);
        return { data: { ok: true } };
      },
      submit: async (kind: string, payload: unknown) => {
        calls.push(["submit", kind, payload]);
        return { data: { id: "inbox_1" } };
      },
    } as never);

    await registry.handle("dcbuilder_create_invite", { label: "Partner" });
    await registry.handle("dcbuilder_refresh_search", { resource: "jobs" });
    await registry.handle("dcbuilder_submit_message", { message: "hello" });

    expect(calls).toEqual([
      ["invite", { label: "Partner" }],
      ["search", { resource: "jobs" }],
      ["submit", "message", { message: "hello" }],
    ]);
  });
});

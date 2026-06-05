import { describe, expect, test } from "bun:test";
import { runCli } from "../src/cli.ts";

const env = {
  DCBUILDER_API_URL: "https://api.example.test",
  DCBUILDER_API_TOKEN: "test-token",
};

describe("runCli", () => {
  test("shows help without requiring credentials", async () => {
    const result = await runCli(["help"], { env: {} });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("credentials");
    expect(result.stderr).toBe("");
  });

  test("runs read commands with JSON as the default format", async () => {
    const requests: Request[] = [];
    const result = await runCli(["news", "--limit", "2"], {
      env,
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ items: [{ id: "news_1" }] });
      },
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ items: [{ id: "news_1" }] });
    expect(requests[0].url).toBe(
      "https://api.example.test/api/agent/news?limit=2",
    );
  });

  test("posts natural language query as an allowlisted query object", async () => {
    const requests: Request[] = [];
    const result = await runCli(
      ["query", "remote zk jobs in Prague limit 5", "--format", "markdown"],
      {
        env,
        fetch: async (input, init) => {
          requests.push(new Request(input, init));
          return Response.json({ items: [{ id: "job_1", title: "ZK" }] });
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("| id | title |");
    expect(requests[0].url).toBe("https://api.example.test/api/agent/query");
    expect(await requests[0].json()).toEqual({
      resource: "jobs",
      filters: {
        query: "zk",
        location: "Prague",
        limit: 5,
        remote: true,
      },
    });
  });

  test("fails cleanly when credentials are missing and 1Password fallback is unavailable", async () => {
    const result = await runCli(["jobs"], {
      env: {},
      fetch: async () => Response.json({ unreachable: true }),
      readSecret: async () => {
        throw new Error("op unavailable");
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("op unavailable");
  });

  test("uses default API URL and 1Password fallback token when env is missing", async () => {
    const requests: Request[] = [];
    const secretCalls: string[][] = [];
    const result = await runCli(["jobs", "--limit", "1"], {
      env: {},
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ data: [] });
      },
      readSecret: async (command) => {
        secretCalls.push(command);
        return "op-token";
      },
    });

    expect(result.exitCode).toBe(0);
    expect(requests[0].url).toBe("https://dcbuilder.dev/api/agent/jobs?limit=1");
    expect(requests[0].headers.get("authorization")).toBe("Bearer op-token");
    expect(requests[0].headers.get("x-api-key")).toBe("op-token");
    expect(secretCalls).toEqual([
      ["op", "read", "op://Agents/DCBUILDER_API_TOKEN/credential"],
    ]);
  });

  test("allows public message submissions without an API token", async () => {
    const requests: Request[] = [];
    const result = await runCli(
      ["submit", "message", "--payload", '{"message":"hello"}'],
      {
        env: { DCBUILDER_API_URL: "https://api.example.test" },
        fetch: async (input, init) => {
          requests.push(new Request(input, init));
          return Response.json({ data: { id: "sub_public", priority: "low" } });
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(requests[0].url).toBe("https://api.example.test/api/agent/submit/message");
    expect(requests[0].headers.get("authorization")).toBeNull();
    expect(requests[0].headers.get("x-api-key")).toBeNull();
    expect(await requests[0].json()).toEqual({ message: "hello" });
  });

  test("routes inbox approval commands", async () => {
    const requests: Request[] = [];
    const result = await runCli(
      [
        "inbox",
        "approve",
        "inbox_1",
        "--payload",
        '{"payload":{"title":"Final"},"note":"ship it"}',
      ],
      {
      env,
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ id: "inbox_1", status: "approved" });
      },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toBe(
      "https://api.example.test/api/agent/inbox/inbox_1/approve",
    );
    expect(await requests[0].json()).toEqual({
      payload: { title: "Final" },
      note: "ship it",
    });
  });

  test("routes backend-only admin commands", async () => {
    const requests: Request[] = [];
    const result = await runCli(
      [
        "invites",
        "create",
        "--payload",
        '{"label":"Partner","allowedKinds":["job"]}',
      ],
      {
        env,
        fetch: async (input, init) => {
          requests.push(new Request(input, init));
          return Response.json({ data: { token: "generated-by-backend" } });
        },
      },
    );
    const refresh = await runCli(
      ["search", "refresh", "--payload", '{"resource":"jobs"}'],
      {
        env,
        fetch: async (input, init) => {
          requests.push(new Request(input, init));
          return Response.json({ data: { ok: true } });
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(refresh.exitCode).toBe(0);
    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ["POST", "https://api.example.test/api/agent/invites"],
      ["POST", "https://api.example.test/api/agent/search/refresh"],
    ]);
    expect(await requests[0].json()).toEqual({
      label: "Partner",
      allowedKinds: ["job"],
    });
    expect(await requests[1].json()).toEqual({ resource: "jobs" });
  });

  test("sends structured query DSL resources supported by the backend", async () => {
    const requests: Request[] = [];
    const result = await runCli(
      [
        "query",
        "--payload",
        '{"table":"investments","where":[{"field":"status","op":"eq","value":"active"}],"filters":{"limit":3}}',
      ],
      {
        env,
        fetch: async (input, init) => {
          requests.push(new Request(input, init));
          return Response.json({ data: [] });
        },
      },
    );

    expect(result.exitCode).toBe(0);
    expect(await requests[0].json()).toEqual({
      table: "investments",
      where: [{ field: "status", op: "eq", value: "active" }],
      filters: { limit: 3 },
    });
  });

  test("parses all backend read filters from command options", async () => {
    const requests: Request[] = [];
    await runCli(
      [
        "jobs",
        "--limit",
        "5",
        "--offset",
        "10",
        "--company",
        "Acme",
        "--category",
        "engineering",
        "--tag",
        "zk",
        "--remote",
      ],
      {
        env,
        fetch: async (input, init) => {
          requests.push(new Request(input, init));
          return Response.json({ data: [] });
        },
      },
    );

    expect(requests[0].url).toBe(
      "https://api.example.test/api/agent/jobs?category=engineering&company=Acme&limit=5&offset=10&remote=true&tags=zk",
    );
  });
});

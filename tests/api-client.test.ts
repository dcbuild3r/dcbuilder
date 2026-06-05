import { describe, expect, test } from "bun:test";
import { ApiError, DcbuilderApiClient } from "../src/api-client.ts";

const credentials = {
  apiUrl: "https://api.example.test",
  apiToken: "test-token",
};

describe("DcbuilderApiClient", () => {
  test("constructs authorized GET requests with structured filters", async () => {
    const requests: Request[] = [];
    const client = new DcbuilderApiClient(credentials, {
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ items: [{ id: "job_1" }] });
      },
    });

    const result = await client.jobs({ limit: 3, tags: ["zk"], remote: true });

    expect(result).toEqual({ items: [{ id: "job_1" }] });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe("GET");
    expect(requests[0].url).toBe(
      "https://api.example.test/api/agent/jobs?limit=3&remote=true&tags=zk",
    );
    expect(requests[0].headers.get("authorization")).toBe("Bearer test-token");
    expect(requests[0].headers.get("x-api-key")).toBe("test-token");
  });

  test("constructs query strings using backend filter names", async () => {
    const requests: Request[] = [];
    const client = new DcbuilderApiClient(credentials, {
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ data: [] });
      },
    });

    await client.candidates({
      availability: "open",
      limit: 25,
      location: "Prague",
      offset: 10,
      tags: ["rust", "zk"],
    });

    expect(requests[0].url).toBe(
      "https://api.example.test/api/agent/candidates?availability=open&limit=25&location=Prague&offset=10&tags=rust&tags=zk",
    );
  });

  test("constructs JSON submit requests for backend submit payloads", async () => {
    const requests: Request[] = [];
    const client = new DcbuilderApiClient(credentials, {
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ id: "inbox_1", status: "pending" });
      },
    });

    await client.submit("job", { title: "Protocol engineer" });

    expect(requests[0].method).toBe("POST");
    expect(requests[0].url).toBe(
      "https://api.example.test/api/agent/submit/job",
    );
    expect(requests[0].headers.get("content-type")).toBe("application/json");
    expect(await requests[0].json()).toEqual({ title: "Protocol engineer" });
  });

  test("constructs invite and search refresh admin requests", async () => {
    const requests: Request[] = [];
    const client = new DcbuilderApiClient(credentials, {
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({ data: { ok: true } });
      },
    });

    await client.createInvite({ label: "Partner", allowedKinds: ["job"] });
    await client.refreshSearch({ resource: "jobs" });

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

  test.each([
    [401, "token expired"],
    [403, "forbidden"],
    [429, "rate limited"],
    [500, "upstream failed"],
  ])("turns %i API failures into status-aware errors", async (status, error) => {
    const client = new DcbuilderApiClient(credentials, {
      fetch: async () => Response.json({ error }, { status }),
    });

    await expect(client.news()).rejects.toMatchObject({
      name: "ApiError",
      status,
      message: error,
    } satisfies Partial<ApiError>);
  });
});

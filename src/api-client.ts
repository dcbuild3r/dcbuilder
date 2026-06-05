import type {
  Filters,
  InboxAction,
  JsonObject,
  QueryDsl,
  ReadResource,
  SubmitKind,
} from "./types.ts";
import type { Credentials } from "./config.ts";

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class ApiError extends Error {
  readonly status: number;
  readonly retryAfter?: string;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown, retryAfter?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

export class DcbuilderApiClient {
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly credentials: Credentials,
    options: { fetch?: FetchLike } = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
  }

  schema(): Promise<unknown> {
    return this.request("/api/agent/schema");
  }

  news(filters: Filters = {}): Promise<unknown> {
    return this.readResource("news", filters);
  }

  jobs(filters: Filters = {}): Promise<unknown> {
    return this.readResource("jobs", filters);
  }

  candidates(filters: Filters = {}): Promise<unknown> {
    return this.readResource("candidates", filters);
  }

  query(query: QueryDsl): Promise<unknown> {
    return this.request("/api/agent/query", { method: "POST", body: query });
  }

  inboxList(filters: Filters = {}): Promise<unknown> {
    return this.request("/api/agent/inbox", { query: filters });
  }

  inboxShow(id: string): Promise<unknown> {
    return this.request(`/api/agent/inbox/${encodeURIComponent(id)}`);
  }

  inboxComment(id: string, comment: string | JsonObject): Promise<unknown> {
    const body = typeof comment === "string" ? { body: comment } : comment;
    return this.request(`/api/agent/inbox/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      body,
    });
  }

  inboxAction(id: string, action: InboxAction, payload: JsonObject = {}): Promise<unknown> {
    return this.request(`/api/agent/inbox/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      body: payload,
    });
  }

  submit(kind: SubmitKind, payload: JsonObject): Promise<unknown> {
    return this.request(`/api/agent/submit/${kind}`, {
      method: "POST",
      body: payload,
    });
  }

  createInvite(payload: JsonObject): Promise<unknown> {
    return this.request("/api/agent/invites", {
      method: "POST",
      body: payload,
    });
  }

  refreshSearch(payload: JsonObject): Promise<unknown> {
    return this.request("/api/agent/search/refresh", {
      method: "POST",
      body: payload,
    });
  }

  private readResource(resource: ReadResource, filters: Filters): Promise<unknown> {
    return this.request(`/api/agent/${resource}`, { query: filters });
  }

  private async request(
    path: string,
    options: {
      method?: "GET" | "POST";
      query?: Filters;
      body?: unknown;
    } = {},
  ): Promise<unknown> {
    const url = new URL(path, `${this.credentials.apiUrl}/`);
    appendQuery(url, options.query);

    const headers = new Headers({ accept: "application/json" });
    if (this.credentials.apiToken) {
      headers.set("authorization", `Bearer ${this.credentials.apiToken}`);
      headers.set("x-api-key", this.credentials.apiToken);
    }

    const init: RequestInit = {
      method: options.method ?? "GET",
      headers,
    };

    if (options.body !== undefined) {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(options.body);
    }

    const response = await this.fetchImpl(url, init);
    const body = await readBody(response);

    if (!response.ok) {
      throw new ApiError(
        response.status,
        extractErrorMessage(body, response.status),
        body,
        response.headers.get("retry-after") ?? undefined,
      );
    }

    return body;
  }
}

function appendQuery(url: URL, query: Filters | undefined): void {
  if (!query) return;

  for (const key of Object.keys(query).sort()) {
    const value = query[key];
    if (value === undefined) continue;

    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      url.searchParams.append(key, String(item));
    }
  }
}

async function readBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(body: unknown, status: number): string {
  if (isRecord(body)) {
    if (typeof body.error === "string") return body.error;
    if (typeof body.message === "string") return body.message;
  }

  if (typeof body === "string" && body.trim()) return body;
  return `dcbuilder.dev API request failed with status ${status}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

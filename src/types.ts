export type Env = Record<string, string | undefined>;

export type Format = "json" | "table" | "markdown";
export type OutputFormat = Format;

export type ReadResource = "news" | "jobs" | "candidates";
export type QueryResource = ReadResource | "investments" | "blog" | "affiliations";
export type Resource = ReadResource;

export type SubmitKind = "job" | "candidate" | "message";

export type InboxAction = "approve" | "reject";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type Filters = Record<string, string | number | boolean | string[] | undefined>;
export type QueryFilters = Filters;

export type QueryDsl = {
  table?: QueryResource;
  resource?: QueryResource;
  filters?: Filters;
  where?: Array<{
    field: string;
    op: "eq" | "contains" | "overlap" | "gte" | "lte" | "ilike";
    value: JsonValue;
  }>;
  select?: string[];
  orderBy?: string;
};
export type AgentQuery = QueryDsl;
export type ApiPayload = unknown;

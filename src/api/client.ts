import {
  ApiError as DcbuilderApiError,
  DcbuilderApiClient as CoreDcbuilderApiClient,
  type FetchLike,
} from "../api-client.ts";
import type { AgentQuery, ApiPayload, JsonObject, QueryFilters } from "../types.ts";

export { DcbuilderApiError };

type ClientOptions = {
  apiUrl: string;
  token: string;
  fetch?: FetchLike;
};

type RequestOptions = {
  query?: QueryFilters;
  body?: unknown;
};

export type LegacyDcbuilderApiClient = {
  fetchSchema: (query?: QueryFilters) => Promise<ApiPayload>;
  listNews: (query?: QueryFilters) => Promise<ApiPayload>;
  listJobs: (query?: QueryFilters) => Promise<ApiPayload>;
  listCandidates: (query?: QueryFilters) => Promise<ApiPayload>;
  queryTable: (body: AgentQuery) => Promise<ApiPayload>;
  listInbox: (query?: QueryFilters) => Promise<ApiPayload>;
  showSubmission: (id: string) => Promise<ApiPayload>;
  commentSubmission: (id: string, body: JsonObject) => Promise<ApiPayload>;
  approveSubmission: (id: string, body?: JsonObject) => Promise<ApiPayload>;
  rejectSubmission: (id: string, body?: JsonObject) => Promise<ApiPayload>;
  submitJob: (body: JsonObject) => Promise<ApiPayload>;
  submitCandidate: (body: JsonObject) => Promise<ApiPayload>;
  submitMessage: (body: JsonObject) => Promise<ApiPayload>;
  createInvite: (body: JsonObject) => Promise<ApiPayload>;
  refreshSearch: (body: JsonObject) => Promise<ApiPayload>;
};

export function createApiClient(options: ClientOptions): LegacyDcbuilderApiClient {
  const client = new CoreDcbuilderApiClient(
    { apiUrl: options.apiUrl, apiToken: options.token },
    { fetch: options.fetch },
  );

  return {
    fetchSchema: () => client.schema(),
    listNews: (query = {}) => client.news(query),
    listJobs: (query = {}) => client.jobs(query),
    listCandidates: (query = {}) => client.candidates(query),
    queryTable: (body) => client.query(body),
    listInbox: (query = {}) => client.inboxList(query),
    showSubmission: (id) => client.inboxShow(id),
    commentSubmission: (id, body) => client.inboxComment(id, body),
    approveSubmission: (id, body = {}) => client.inboxAction(id, "approve", body),
    rejectSubmission: (id, body = {}) => client.inboxAction(id, "reject", body),
    submitJob: (body) => client.submit("job", body),
    submitCandidate: (body) => client.submit("candidate", body),
    submitMessage: (body) => client.submit("message", body),
    createInvite: (body) => client.createInvite(body),
    refreshSearch: (body) => client.refreshSearch(body),
  };
}

import type { Env } from "./types.ts";

export type Credentials = {
  apiUrl: string;
  apiToken?: string;
};

export function resolveCredentials(env: Env = Bun.env): Credentials {
  const apiUrl = env.DCBUILDER_API_URL?.trim().replace(/\/+$/, "");
  const apiToken = env.DCBUILDER_API_TOKEN?.trim();

  if (!apiUrl || !apiToken) {
    throw new Error("DCBUILDER_API_URL and DCBUILDER_API_TOKEN are required");
  }

  validateApiUrl(apiUrl);
  return { apiUrl, apiToken };
}

export function resolveApiUrl(env: Env = Bun.env): string {
  const apiUrl = env.DCBUILDER_API_URL?.trim().replace(/\/+$/, "");

  if (!apiUrl) {
    throw new Error("DCBUILDER_API_URL is required");
  }

  validateApiUrl(apiUrl);

  return apiUrl;
}

function validateApiUrl(apiUrl: string): void {
  try {
    new URL(apiUrl);
  } catch {
    throw new Error("DCBUILDER_API_URL must be a valid URL");
  }
}

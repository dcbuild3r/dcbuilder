import type { Env } from "./types.ts";

const DEFAULT_API_URL = "https://dcbuilder.dev";
const DEFAULT_1PASSWORD_TOKEN_REF = "op://Agents/DCBUILDER_API_TOKEN/credential";

export type Credentials = {
  apiUrl: string;
  apiToken?: string;
};

export type CredentialFallbackOptions = {
  readSecret?: (command: string[]) => Promise<string>;
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

export async function resolveCredentialsWithFallback(
  env: Env = Bun.env,
  options: CredentialFallbackOptions = {},
): Promise<Credentials> {
  const apiUrl = resolveApiUrl(env);
  const envToken = env.DCBUILDER_API_TOKEN?.trim();
  if (envToken) return { apiUrl, apiToken: envToken };

  const tokenRef = env.DCBUILDER_1PASSWORD_TOKEN_REF?.trim() || DEFAULT_1PASSWORD_TOKEN_REF;
  const readSecret = options.readSecret ?? readSecretWithOp;
  const apiToken = (await readSecret(["op", "read", tokenRef])).trim();
  if (!apiToken) {
    throw new Error("DCBUILDER_API_TOKEN is required; 1Password returned an empty token");
  }

  return { apiUrl, apiToken };
}

export function resolveApiUrl(env: Env = Bun.env): string {
  const apiUrl = (env.DCBUILDER_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");

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

async function readSecretWithOp(command: string[]): Promise<string> {
  const process = Bun.spawn(command, {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  if (exitCode !== 0) {
    const detail = stderr.trim() ? `: ${stderr.trim()}` : "";
    throw new Error(
      `DCBUILDER_API_TOKEN is required; set it in env or unlock 1Password CLI${detail}`,
    );
  }

  return stdout;
}

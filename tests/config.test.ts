import { describe, expect, test } from "bun:test";
import { resolveCredentials, resolveCredentialsWithFallback } from "../src/config.ts";

describe("resolveCredentials", () => {
  test("reads API URL and token from environment variables", () => {
    expect(
      resolveCredentials({
        DCBUILDER_API_URL: "https://dcbuilder.dev/",
        DCBUILDER_API_TOKEN: "secret-token",
      }),
    ).toEqual({
      apiUrl: "https://dcbuilder.dev",
      apiToken: "secret-token",
    });
  });

  test("fails without persisting or inventing missing credentials", () => {
    expect(() => resolveCredentials({ DCBUILDER_API_URL: "" })).toThrow(
      "DCBUILDER_API_URL and DCBUILDER_API_TOKEN are required",
    );
  });

  test("uses the default dcbuilder.dev URL and reads missing tokens from 1Password", async () => {
    const calls: string[][] = [];

    const credentials = await resolveCredentialsWithFallback(
      {},
      {
        readSecret: async (command) => {
          calls.push(command);
          return "op-token";
        },
      },
    );

    expect(credentials).toEqual({
      apiUrl: "https://dcbuilder.dev",
      apiToken: "op-token",
    });
    expect(calls).toEqual([
      ["op", "read", "op://Agents/DCBUILDER_API_TOKEN/credential"],
    ]);
  });

  test("lets local users override the 1Password token reference", async () => {
    const calls: string[][] = [];

    await resolveCredentialsWithFallback(
      { DCBUILDER_1PASSWORD_TOKEN_REF: "op://Private/dcli/token" },
      {
        readSecret: async (command) => {
          calls.push(command);
          return "custom-token";
        },
      },
    );

    expect(calls).toEqual([["op", "read", "op://Private/dcli/token"]]);
  });

  test("keeps environment tokens higher priority than 1Password", async () => {
    const credentials = await resolveCredentialsWithFallback(
      {
        DCBUILDER_API_URL: "https://custom.example/",
        DCBUILDER_API_TOKEN: "env-token",
      },
      {
        readSecret: async () => {
          throw new Error("should not call op");
        },
      },
    );

    expect(credentials).toEqual({
      apiUrl: "https://custom.example",
      apiToken: "env-token",
    });
  });
});

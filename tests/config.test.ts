import { describe, expect, test } from "bun:test";
import { resolveCredentials } from "../src/config.ts";

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
});

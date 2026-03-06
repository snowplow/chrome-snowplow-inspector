import { describe, expect, jest, test, beforeEach } from "@jest/globals";
import { SignalsClient } from "./SignalsClient";
import { version } from "../../../package.json";

jest.mock("@snowplow/signals-core", () => ({
  SignalsCore: class {
    constructor() {}
  },
}));

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe("SignalsClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("sets X-Signals-Sdk-Name header with version", async () => {
    const client = new SignalsClient({
      baseUrl: "https://example.com",
      apiKey: "test-key",
      apiKeyId: "test-key-id",
      organizationId: "test-org",
    });

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    await client.fetch("https://example.com/test", {
      method: "GET",
      headers: {},
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Signals-Sdk-Name": `snowplow-inspector ${version}`,
        }),
      }),
    );
  });
});

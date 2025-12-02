import { describe, expect, test } from "@jest/globals";

import { decodeB64Thrift, encodeB64Thrift, schemas } from "./thriftcodec";

import { bad } from "../../test/data" with { type: "json" };

describe("decodeB64Thrift", () => {
  test("decodes bad row", () => {
    expect(
      decodeB64Thrift(
        bad.collector_payload_format_violation.data.payload_str,
        schemas["collector-payload"],
      ),
    ).toMatchObject({
      schema:
        "iglu:com.snowplowanalytics.snowplow/CollectorPayload/thrift/1-0-0",
    });
  });

  test("round trips", () => {
    expect(
      encodeB64Thrift(
        decodeB64Thrift(
          bad.collector_payload_format_violation.data.payload_str,
          schemas["collector-payload"],
        ),
        schemas["collector-payload"],
      ),
    ).toBe(bad.collector_payload_format_violation.data.payload_str);
  });
});

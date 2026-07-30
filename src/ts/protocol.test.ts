import { describe, expect, test } from "@jest/globals";
import { enrichedFieldLabel } from "./protocol";

describe("enrichedFieldLabel", () => {
  test("names the attribute keys Signals can be scoped to", () => {
    expect(enrichedFieldLabel("domain_sessionid")).toBe("Domain Session ID");
    expect(enrichedFieldLabel("domain_userid")).toBe("Domain User ID");
    expect(enrichedFieldLabel("network_userid")).toBe("Network User ID");
  });

  test("falls back to the raw name for fields with no parameter", () => {
    // event_name is an enriched-only field, mapped to "" in esMap
    expect(enrichedFieldLabel("event_name")).toBe("event_name");
  });

  test("falls back to the raw name for anything unrecognised", () => {
    expect(enrichedFieldLabel("not_a_field")).toBe("not_a_field");
    expect(enrichedFieldLabel("")).toBe("");
  });
});

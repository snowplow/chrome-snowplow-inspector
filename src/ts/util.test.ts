import { describe, expect, test } from "@jest/globals";

import { formatDuration, isSnowplow, nameType } from "./util";

import { micro } from "../../test/data" with { type: "json" };

describe("isSnowplow", () => {
  test("recognizes get request", () => {
    expect(isSnowplow(micro.get.log.entries[0].request)).toBe(true);
  });

  test("recognizes post request", () => {
    expect(isSnowplow(micro.post.log.entries[0].request)).toBe(true);
  });

  test("recognizes custom post path", () => {
    expect(isSnowplow(micro.custom.log.entries[0].request)).toBe(true);
  });
});

describe("nameType", () => {
  test.each([
    [false, "boolean"],
    [true, "boolean"],
    [null, "null"],
    [undefined, "undefined"],
    ["test", "string"],
    ["", "string"],
    [1, "number"],
    [0, "number"],
    [NaN, "number (NaN)"],
    [Infinity, "number (Infinite)"],
    [[], "array (Empty)"],
    [[0], "array"],
    [{}, "object"],
    [new Date(), "Date"],
    [/a/, "RegExp"],
    [Promise.resolve(), "Promise"],
  ])("name of %j", (val, expected) => {
    expect(nameType(val)).toBe(expected);
  });
});

describe("formatDuration", () => {
  test("reports seconds below a minute", () => {
    expect(formatDuration(30)).toBe("30s");
  });

  test("reports whole minutes", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(1800)).toBe("30m");
  });

  test("reports hours, dropping a trailing zero", () => {
    expect(formatDuration(3600)).toBe("1h");
  });

  test("reports fractional hours", () => {
    expect(formatDuration(5400)).toBe("1.5h");
  });
});

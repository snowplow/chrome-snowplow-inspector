import { describe, expect, test } from "@jest/globals";

import { isSnowplow, nameType } from "./util";

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

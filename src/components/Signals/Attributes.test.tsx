import { describe, expect, test } from "@jest/globals";
import { showAddAPIKeyButton, formatError } from "./Attributes";
import { SignalsAPIError } from "@snowplow/signals-core";

describe("Attributes - Error Parsing", () => {
  describe("showAddAPIKeyButton", () => {
    test("returns true for SignalsAPIError with 401 status", () => {
      const error = new SignalsAPIError(401, "Unauthorized");
      expect(showAddAPIKeyButton("error", error)).toBe(true);
    });

    test("returns false for SignalsAPIError with non-401 status", () => {
      const error = new SignalsAPIError(500, "Internal Server Error");
      expect(showAddAPIKeyButton("error", error)).toBe(false);
    });

    test("returns false when attribute is not 'error'", () => {
      const error = new SignalsAPIError(401, "Unauthorized");
      expect(showAddAPIKeyButton("someOtherAttribute", error)).toBe(false);
    });

    test("returns false for string error messages", () => {
      expect(showAddAPIKeyButton("error", "Some error message")).toBe(false);
    });

    test("returns false for other error types", () => {
      expect(showAddAPIKeyButton("error", new Error("Something failed"))).toBe(
        false,
      );
    });
  });

  describe("formatError", () => {
    test("extracts error from SignalsAPIError with JSON response", () => {
      const error = new SignalsAPIError(
        401,
        '{"error": "Invalid or expired JWT"}',
      );
      expect(formatError(error)).toBe("Invalid or expired JWT");
    });

    test("returns raw response from SignalsAPIError when not JSON", () => {
      const error = new SignalsAPIError(500, "Internal Server Error");
      expect(formatError(error)).toBe("Internal Server Error");
    });

    test("returns SignalsAPIError response when JSON has no error field", () => {
      const error = new SignalsAPIError(403, '{"message": "Forbidden"}');
      expect(formatError(error)).toBe('{"message": "Forbidden"}');
    });

    test("converts string values to string", () => {
      expect(formatError("Plain error message")).toBe("Plain error message");
    });

    test("converts number values to string", () => {
      expect(formatError(12345)).toBe("12345");
    });

    test("converts null value to string", () => {
      expect(formatError(null)).toBe("null");
    });

    test("stringifies objects", () => {
      expect(formatError({ code: 500, message: "Error" })).toBe(
        '{"code":500,"message":"Error"}',
      );
    });

    test("stringifies arrays", () => {
      expect(formatError([1, 2, 3])).toBe("[1,2,3]");
    });
  });
});

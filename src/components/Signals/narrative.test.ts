import { describe, expect, test } from "@jest/globals";
import { isColumnHeader, isEmptyBuffer, withoutPrompt } from "./narrative";

const PROMPT = "Summarise what the user is trying to accomplish.";

describe("Signals - Agentic context narratives", () => {
  describe("withoutPrompt", () => {
    test("drops the prompt the narrative repeats back", () => {
      expect(withoutPrompt(`${PROMPT}\n[START CONTEXT]`, PROMPT)).toBe(
        "[START CONTEXT]",
      );
    });

    test("tolerates whitespace around the prompt and the narrative", () => {
      expect(withoutPrompt(`\n  ${PROMPT}  \n\nbody`, `  ${PROMPT}\n`)).toBe(
        "body",
      );
    });

    test("leaves the narrative alone when there is no prompt", () => {
      expect(withoutPrompt("[START CONTEXT]", null)).toBe("[START CONTEXT]");
    });

    test("leaves the narrative alone when the prompt is empty", () => {
      expect(withoutPrompt("[START CONTEXT]", "   ")).toBe("[START CONTEXT]");
    });

    test("leaves the narrative alone when it does not lead with the prompt", () => {
      const narrative = `[START CONTEXT]\n${PROMPT}`;
      expect(withoutPrompt(narrative, PROMPT)).toBe(narrative);
    });

    test("only strips the prompt from the front, not later repeats", () => {
      expect(withoutPrompt(`${PROMPT}\nbody\n${PROMPT}`, PROMPT)).toBe(
        `body\n${PROMPT}`,
      );
    });

    test("returns empty when the narrative is nothing but the prompt", () => {
      expect(withoutPrompt(PROMPT, PROMPT)).toBe("");
    });
  });

  describe("isEmptyBuffer", () => {
    test("detects the empty buffer message", () => {
      expect(isEmptyBuffer("[START CONTEXT]\nNo events buffered.")).toBe(true);
    });

    test("ignores case and a missing full stop", () => {
      expect(isEmptyBuffer("no events buffered")).toBe(true);
    });

    test("is false for a populated narrative", () => {
      expect(isEmptyBuffer("0, page_view, /home, {}")).toBe(false);
    });
  });

  describe("isColumnHeader", () => {
    test("matches the event log column header", () => {
      expect(
        isColumnHeader(
          "seconds_since_start_of_session, event, url, event_context",
        ),
      ).toBe(true);
    });

    test("does not match a data row", () => {
      expect(
        isColumnHeader(
          "0, page_view, /data-structures, {step_action: 'open_ui'}",
        ),
      ).toBe(false);
    });

    test("does not match prose with a single comma", () => {
      expect(isColumnHeader("Hello, world")).toBe(false);
    });

    test("does not match prose with capitalised words", () => {
      expect(isColumnHeader("Events, Sessions, Users")).toBe(false);
    });

    test("does not match the context delimiters", () => {
      expect(isColumnHeader("[START CONTEXT]")).toBe(false);
      expect(isColumnHeader("## Real-time user behaviour")).toBe(false);
    });

    test("does not match a line without commas", () => {
      expect(isColumnHeader("event")).toBe(false);
    });

    test("requires at least three columns", () => {
      expect(isColumnHeader("event, url")).toBe(false);
      expect(isColumnHeader("event, url, referrer")).toBe(true);
    });
  });
});

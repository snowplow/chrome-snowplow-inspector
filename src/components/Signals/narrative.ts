/** Pure helpers for presenting agentic context narratives. */

/** the buffer exists but has nothing in it; not worth showing an empty block */
const EMPTY_BUFFER = /no events buffered/i;

/**
 * Rows of the event log are comma separated, headed by a line naming the
 * columns. Require several lowercase snake_case names: prose can carry a comma
 * or two ("Hello, world"), but not three bare identifiers in a row, and data
 * rows always lead with a number.
 */
const COLUMN_HEADER = /^[a-z][a-z0-9_]*(?:\s*,\s*[a-z][a-z0-9_]*){2,}$/;

/**
 * The narrative repeats the definition's prompt before the context itself, so
 * drop it when it is there; falls back to the full text if the format changes.
 */
export const withoutPrompt = (narrative: string, prompt: string | null) => {
  const preamble = prompt?.trim();
  const body = narrative.trimStart();

  return preamble && body.startsWith(preamble)
    ? body.slice(preamble.length).trimStart()
    : narrative;
};

export const isEmptyBuffer = (narrative: string) =>
  EMPTY_BUFFER.test(narrative);

export const isColumnHeader = (line: string) => COLUMN_HEADER.test(line.trim());

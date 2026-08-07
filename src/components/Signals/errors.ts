import { SignalsAPIError } from "@snowplow/signals-core";

/** the credentials in use aren't allowed to read this resource */
export function isUnauthorized(value: unknown): boolean {
  return value instanceof SignalsAPIError && value.status === 401;
}

/** for callers holding attribute/value pairs, where only `error` carries one */
export function showAddAPIKeyButton(
  attribute: string,
  value: unknown,
): boolean {
  return attribute === "error" && isUnauthorized(value);
}

/** the useful part of an error body, which the API documents as `{error}` */
function errorDetail(response: unknown): string {
  if (typeof response !== "string")
    return response == null ? "" : JSON.stringify(response);

  try {
    const { error } = JSON.parse(response);
    if (error) return String(error);
  } catch {
    // not JSON, so the raw body is the best we have
  }

  return response;
}

export function formatError(value: unknown): string {
  if (value instanceof SignalsAPIError) {
    const detail = errorDetail(value.response);

    return detail ? `${value.status}: ${detail}` : `HTTP ${value.status}`;
  }

  // Error properties aren't enumerable, so JSON.stringify would only give "{}"
  if (value instanceof Error) return value.message;

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

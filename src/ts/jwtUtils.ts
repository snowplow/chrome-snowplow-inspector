import type { OAuthResult } from "./types";

export function getOrgIdFromJWT(
  login: OAuthResult | undefined,
): string | undefined {
  return login?.access?.["https://snowplowanalytics.com/roles"]?.user
    ?.organization?.id;
}

import { uuidv4, tryb64 } from "./util";
import type { OAuthAccess, OAuthIdentity, OAuthResult } from "./types";

const prodExtIds = [
  "4166b542-f87d-4dbc-a6b1-34cb31a5b04e",
  "maplkdomeamdlngconidoefjpogkmljm",
];

const CONSOLE_OAUTH_AUDIENCE = "https://snowplowanalytics.com/api/";
const CONSOLE_OAUTH_SCOPES = "openid profile";

export const { CONSOLE_API, OAUTH_FLOW, CONSOLE_OAUTH_CLIENTID } =
  prodExtIds.includes(chrome.runtime.id)
    ? {
        CONSOLE_API: "https://console.snowplowanalytics.com/",
        CONSOLE_OAUTH_CLIENTID: "ljiYxb2Cs1gyN0wTWvfByrt1jdRaqxyM",
        OAUTH_FLOW: "https://id.snowplowanalytics.com/",
      }
    : {
        CONSOLE_API: "https://next.console.snowplowanalytics.com/",
        CONSOLE_OAUTH_CLIENTID: "xLciUpURW0s0SV5wF2kZ7WLQWkaa9fS9",
        OAUTH_FLOW: "https://next.id.snowplowanalytics.com/",
      };

const b64url = (s: string) =>
  btoa(s).replace(/[\+\/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);

export const apiFetch = (
  path: string,
  opts?: Parameters<typeof fetch>[1],
  org?: string,
) =>
  fetch(
    new URL(
      `/api/msc/v1/${org ? `organizations/${org}/${path}` : path}`,
      CONSOLE_API,
    ),
    opts,
  ).then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)));

export const doOAuthFlow = (interactive = false): Promise<OAuthResult> => {
  const flowUrl = new URL("authorize", OAUTH_FLOW);

  const state = uuidv4();
  const nonce = b64url(
    String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
  );

  // OAuth Implicit Flow
  // https://auth0.com/docs/api/authentication#implicit-flow
  Object.entries({
    response_type: "id_token token",
    client_id: CONSOLE_OAUTH_CLIENTID,
    redirect_uri: chrome.identity.getRedirectURL(),
    scope: CONSOLE_OAUTH_SCOPES,
    audience: CONSOLE_OAUTH_AUDIENCE,
    nonce,
    state,
  }).forEach(([key, val]) => flowUrl.searchParams.set(key, val));

  if (!interactive) flowUrl.searchParams.set("prompt", "none");

  return new Promise<OAuthResult>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { interactive, url: flowUrl.toString() },
      (responseUrl) => {
        if (!responseUrl) throw reject(new Error("No OAuth redirect detected"));

        const response = new URL(responseUrl);
        const fragParams = new URLSearchParams(response.hash.slice(1));
        const access_token = fragParams.get("access_token");
        const id_token = fragParams.get("id_token");
        const token_type = fragParams.get("token_type");
        const respState = fragParams.get("state");

        if (
          respState !== state ||
          token_type !== "Bearer" ||
          !access_token ||
          !id_token
        ) {
          console.error("auth failed", access_token, id_token, token_type);
          throw reject(
            new Error("OAuth protocol failure failure during authentication"),
          );
        }

        const encIdentity = id_token.split(".")[1];
        const encAccess = access_token.split(".")[1];

        const decIdentity = tryb64(encIdentity);
        const decAccess = tryb64(encAccess);
        if (decIdentity === encIdentity || decAccess === encAccess) {
          console.error("could not decode identity/access token", encIdentity);
          throw reject(new Error("Unable to process OAuth user identity"));
        }

        const identity: OAuthIdentity = JSON.parse(decIdentity);
        const access: OAuthAccess = JSON.parse(decAccess);

        const authentication = {
          headers: { Authorization: `Bearer ${access_token}` },
        };

        const logout = () => {
          const flowUrl = new URL("oidc/logout", OAUTH_FLOW);
          Object.entries({
            client_id: CONSOLE_OAUTH_CLIENTID,
            logout_hint: identity.sid,
          }).forEach(([key, val]) => flowUrl.searchParams.set(key, val));

          return new Promise<string>((resolve, reject) =>
            chrome.identity.launchWebAuthFlow(
              { interactive: false, url: flowUrl.toString() },
              (url) => (url ? resolve(url) : reject()),
            ),
          );
        };

        return resolve({ identity, access, authentication, logout });
      },
    );
  });
};

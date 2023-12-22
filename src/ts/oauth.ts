import { uuidv4, tryb64 } from "./util";
import type { OAuthAccess, OAuthIdentity } from "./types";

const prodExtIds = [
  "4166b542-f87d-4dbc-a6b1-34cb31a5b04e",
  "maplkdomeamdlngconidoefjpogkmljm",
];

const PROD_OAUTH_FLOW = "https://id.snowplowanalytics.com/";
const PROD_OAUTH_CLIENTID = "ljiYxb2Cs1gyN0wTWvfByrt1jdRaqxyM";

const NONPROD_OAUTH_FLOW = "https://next.id.snowplowanalytics.com/";
const NONPROD_OAUTH_CLIENTID = "xLciUpURW0s0SV5wF2kZ7WLQWkaa9fS9";

const CONSOLE_OAUTH_AUDIENCE = "https://snowplowanalytics.com/api/";
const CONSOLE_OAUTH_SCOPES = "openid profile";

const OAUTH_FLOW = prodExtIds.includes(chrome.runtime.id)
  ? PROD_OAUTH_FLOW
  : NONPROD_OAUTH_FLOW;

const CONSOLE_OAUTH_CLIENTID = prodExtIds.includes(chrome.runtime.id)
  ? PROD_OAUTH_CLIENTID
  : NONPROD_OAUTH_CLIENTID;

const b64url = (s: string) =>
  btoa(s).replace(/[\+\/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);

type OAuthResult = {
  identity: OAuthIdentity;
  access: OAuthAccess;
  authentication: Partial<RequestInit>;
};

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

        return resolve({ identity, access, authentication });
      },
    );
  });
};

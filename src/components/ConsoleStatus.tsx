import { h, FunctionComponent } from "preact";
import { useCallback, useState } from "preact/hooks";

import { uuidv4, tryb64 } from "../ts/util";
import { IConsoleStatus, OAuthIdentity } from "../ts/types";

import "./ConsoleStatus.scss";

const prodExtIds = [
  "4166b542-f87d-4dbc-a6b1-34cb31a5b04e",
  "maplkdomeamdlngconidoefjpogkmljm",
];

const PROD_OAUTH_FLOW = "https://id.snowplowanalytics.com/";
const NONPROD_OAUTH_FLOW = "https://next.id.snowplowanalytics.com/";
const OAUTH_FLOW = prodExtIds.includes(chrome.runtime.id)
  ? PROD_OAUTH_FLOW
  : NONPROD_OAUTH_FLOW;

const PROD_CONSOLE_API = "https://console.snowplowanalytics.com/api/msc/v1/";
const NONPROD_CONSOLE_API =
  "https://next.console.snowplowanalytics.com/api/msc/v1/";
const CONSOLE_API = prodExtIds.includes(chrome.runtime.id)
  ? PROD_CONSOLE_API
  : NONPROD_CONSOLE_API;

const CONSOLE_OAUTH_CLIENTID = "tL5d0RJbXuUNTOmSETFMUBf8FaWAKXhu";
const CONSOLE_OAUTH_AUDIENCE = "https://snowplowanalytics.com/api/";
const CONSOLE_OAUTH_SCOPES = "openid profile";

export const apiFetch = (path: string, opts?: Parameters<typeof fetch>[1]) =>
  fetch(new URL(path, CONSOLE_API), opts).then((r) => r.json());

const b64url = (s: string) =>
  btoa(s).replace(/[\+\/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" })[c]!);

export const ConsoleStatus: FunctionComponent<IConsoleStatus> = ({
  resolver,
  setModal,
}) => {
  const [status, setStatus] = useState("idle");
  const [identity, setIdentity] = useState<OAuthIdentity>();

  const handler = useCallback(() => {
    setStatus("pending");
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

    chrome.identity.launchWebAuthFlow(
      { interactive: true, url: flowUrl.toString() },
      (responseUrl) => {
        if (responseUrl) {
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
            setStatus("idle");
            return console.error(
              "auth failed",
              access_token,
              id_token,
              token_type,
            );
          }
          const [header, encIdentity, sig] = id_token.split(".");

          const decIdentity = tryb64(encIdentity);
          if (decIdentity === encIdentity) {
            setStatus("idle");
            return console.error(
              "could not decode identity token",
              encIdentity,
            );
          }

          const identity: OAuthIdentity = JSON.parse(decIdentity);
          setStatus("authenticated");
          setIdentity(identity);

          const authentication = {
            headers: { Authorization: `Bearer ${access_token}` },
          };

          apiFetch("organizations", authentication)
            .then((organizations) => {
              console.log("orgs", organizations);
              setModal("consoleSync", {
                organizations,
                authentication,
                identity,
                resolver,
              });
            })
            .catch(console.error);
        } else setStatus("idle");
      },
    );
  }, []);

  return status === "authenticated" && identity ? (
    <button
      class="console"
      disabled
      title={`Console: ${identity.iss}\nLogin: ${identity.sub}\nLast Update: ${
        identity.updated_at
      }\n\n${JSON.stringify(identity)}`}
    >
      <img src={identity.picture} />
      {identity.name || "Logged In"}
    </button>
  ) : (
    <button
      class="console"
      disabled={status !== "idle"}
      onClick={status === "idle" ? handler : undefined}
    >
      {status === "idle" ? "Sync with Console" : "Awaiting Authentication"}
    </button>
  );
};

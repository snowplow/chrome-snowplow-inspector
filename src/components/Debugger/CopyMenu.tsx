import { h, FunctionComponent } from "preact";
import { IBeaconSummary } from "../../ts/types";
import { copyToClipboard, tryb64 } from "../../ts/util";
import { unpackSDJ } from "./TestSuites";

const wrapPost = (data: object) => {
  return {
    schema: "iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4",
    data: [data],
  };
};

export const CopyMenu: FunctionComponent<{
  beacon: IBeaconSummary;
}> = ({ beacon }) => {
  const { collector, payload } = beacon;

  return (
    <div class="dropdown button is-hoverable is-up is-dark">
      <div class="dropdown-trigger">{"\u29c9"}</div>
      <div class="dropdown-menu">
        <div class="dropdown-content">
          <div class="dropdown-item">{"Copy as\u2026"}</div>
          <div
            class="dropdown-item"
            onClick={() =>
              copyToClipboard(
                JSON.stringify(wrapPost(Object.fromEntries(payload.entries())))
              )
            }
          >
            JSON
          </div>
          <div
            class="dropdown-item"
            onClick={() =>
              copyToClipboard(
                JSON.stringify(
                  wrapPost(Object.fromEntries(payload.entries())),
                  null,
                  4
                )
              )
            }
          >
            JSON (Pretty)
          </div>
          <div
            class="dropdown-item"
            onClick={() => {
              const event = Object.fromEntries(payload.entries());

              try {
                if (event.ue_pr || event.ue_px) {
                  const extracted = JSON.parse(
                    tryb64(event.ue_pr || event.ue_px)
                  );
                  if (
                    typeof extracted === "object" &&
                    "schema" in extracted &&
                    "data" in extracted &&
                    /^iglu:com.snowplowanalytics.snowplow\/unstruct_event\//.test(
                      extracted.schema
                    )
                  )
                    Object.assign(event, {
                      unstruct: unpackSDJ([extracted.data]),
                    });
                }

                if (event.co || event.cx) {
                  const extracted = JSON.parse(
                    tryb64(event.co || event.cx)
                  );
                  if (
                    typeof extracted === "object" &&
                    "schema" in extracted &&
                    "data" in extracted &&
                    /^iglu:com.snowplowanalytics.snowplow\/contexts\//.test(
                      extracted.schema
                    )
                  )
                    Object.assign(event, {
                      context: unpackSDJ(extracted.data),
                    });
                }
              } catch (e) {}

              copyToClipboard(
                JSON.stringify(Object.assign({}, beacon, { payload: event }), null, 4)
              );
            }}
          >
            Test Case Input
          </div>
          <div
            class="dropdown-item"
            onClick={() => {
              const u = new URL(`https://${collector}/i`);
              payload.forEach((v, k) => u.searchParams.append(k, v));
              copyToClipboard(u.href);
            }}
          >
            URL - GET
          </div>
          <div
            class="dropdown-item"
            onClick={() => {
              const ua = payload.get("ua");
              const lang = payload.get("lang");

              const data = Object.fromEntries(payload.entries());

              delete data["ua"];
              delete data["lang"];

              const cmd = [
                `curl 'https://${collector}/com.snowplowanalytics.snowplow/tp2'`,
                "--compressed",
                ua && `-A ${JSON.stringify(ua)}`,
                // shell will merge the consecutive strings
                lang && `-H "Accept-Language: "${JSON.stringify(lang)}`,
                `-H "Content-Type: application/json; charset=UTF-8"`,
                // double stringify to escape quotes properly
                `--data-raw ${JSON.stringify(JSON.stringify(wrapPost(data)))}`,
              ];

              copyToClipboard(cmd.filter(Boolean).join(" \\\n  "));
            }}
          >
            cURL
          </div>
          {payload.get("e") == "ue" && (
            <a
              class="dropdown-item"
              onClick={() => {
                const aid = payload.get("aid");
                const ue = JSON.parse(
                  tryb64(payload.get("ue_pr") || payload.get("ue_px") || "{}")
                );
                const ctx = JSON.parse(
                  tryb64(payload.get("co") || payload.get("cx") || "{}")
                );

                const cmd = [
                  `snowplow-tracking-cli --collector ${JSON.stringify(
                    collector
                  )}`,
                  aid && `--appid ${JSON.stringify(aid)}`,
                  `--schema ${JSON.stringify(ue.data.schema)}`,
                  // double stringify to escape quotes properly
                  `--json ${JSON.stringify(JSON.stringify(ue.data.data))}`,
                  `--contexts ${JSON.stringify(JSON.stringify(ctx.data))}`,
                ];

                copyToClipboard(cmd.filter(Boolean).join(" \\\n  "));
              }}
            >
              Snowplow CLI
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

import { h, FunctionComponent } from "preact";
import { IBeaconDetails } from "../../ts/types";
import { copyToClipboard, tryb64 } from "../../ts/util";

const wrapPost = (data: object) => {
  return {
    schema: "iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4",
    data: [data],
  };
};

export const CopyMenu: FunctionComponent<{
  collector: string;
  beacon: IBeaconDetails["payload"];
}> = ({ collector, beacon }) =>
  beacon ? (
    <div class="dropdown button is-hoverable is-up is-dark">
      <div class="dropdown-trigger">{"\u29c9"}</div>
      <div class="dropdown-menu">
        <div class="dropdown-content">
          <div class="dropdown-item">{"Copy as\u2026"}</div>
          <div
            class="dropdown-item"
            onClick={() =>
              copyToClipboard(
                JSON.stringify(wrapPost(Object.fromEntries(beacon.entries())))
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
                  wrapPost(Object.fromEntries(beacon.entries())),
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
              const u = new URL(`https://${collector}/i`);
              beacon.forEach((v, k) => u.searchParams.append(k, v));
              copyToClipboard(u.href);
            }}
          >
            URL - GET
          </div>
          <div
            class="dropdown-item"
            onClick={() => {
              const ua = beacon.get("ua");
              const lang = beacon.get("lang");

              const data = Object.fromEntries(beacon.entries());

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
          {beacon.get("e") == "ue" && (
            <a
              class="dropdown-item"
              onClick={() => {
                const aid = beacon.get("aid");
                const ue = JSON.parse(
                  tryb64(beacon.get("ue_pr") || beacon.get("ue_px") || "{}")
                );
                const ctx = JSON.parse(
                  tryb64(beacon.get("co") || beacon.get("cx") || "{}")
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
  ) : null;

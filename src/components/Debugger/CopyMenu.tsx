import { h, FunctionComponent } from "preact";
import { esMap } from "../../ts/protocol";
import { IBeaconSummary } from "../../ts/types";
import { copyToClipboard, tryb64 } from "../../ts/util";
import { unpackSDJ } from "./TestSuites";

const wrapPost = (data: object | object[]) => {
  return {
    schema: "iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4",
    data: Array.isArray(data) ? data : [data],
  };
};

const formatters: Record<string, (beacon: IBeaconSummary) => string> = {
  JSON: ({ payload }: IBeaconSummary) =>
    JSON.stringify(wrapPost(Object.fromEntries(payload.entries()))),
  "JSON (Pretty)": ({ payload }: IBeaconSummary) =>
    JSON.stringify(wrapPost(Object.fromEntries(payload.entries())), null, 4),
  "Test Case Input": (beacon: IBeaconSummary) => {
    const event = Object.fromEntries(beacon.payload.entries());

    try {
      if (event.ue_pr || event.ue_px) {
        const extracted = JSON.parse(tryb64(event.ue_pr || event.ue_px));
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
        const extracted = JSON.parse(tryb64(event.co || event.cx));
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

    return JSON.stringify(
      [Object.assign({}, beacon, { payload: event })],
      null,
      4
    );
  },
  "URL - Get": ({ collector, payload }: IBeaconSummary) => {
    const u = new URL(`https://${collector}/i`);
    payload.forEach((v, k) => u.searchParams.append(k, v));
    return u.href;
  },
  cURL: ({ collector, payload }: IBeaconSummary) => {
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

    return cmd.filter(Boolean).join(" \\\n  ");
  },
  "Snowplow CLI": ({ collector, payload }: IBeaconSummary) => {
    const aid = payload.get("aid");
    const ue = JSON.parse(
      tryb64(payload.get("ue_pr") || payload.get("ue_px") || "{}")
    );
    const ctx = JSON.parse(
      tryb64(payload.get("co") || payload.get("cx") || "{}")
    );

    const cmd = [
      `snowplow-tracking-cli --collector ${JSON.stringify(collector)}`,
      aid && `--appid ${JSON.stringify(aid)}`,
      `--schema ${JSON.stringify(ue.data.schema)}`,
      // double stringify to escape quotes properly
      `--json ${JSON.stringify(JSON.stringify(ue.data.data))}`,
      `--contexts ${JSON.stringify(JSON.stringify(ctx.data))}`,
    ];

    return cmd.filter(Boolean).join(" \\\n  ");
  },
} as const;

const checks: Record<string, (beacon: IBeaconSummary) => boolean> = {
  "Snowplow CLI": ({ payload }: IBeaconSummary) => payload.get("e") === "ue",
};

export const CopyMenu: FunctionComponent<{
  beacon: IBeaconSummary;
}> = ({ beacon }) => (
  <div class="dropdown button is-hoverable is-up is-dark">
    <div class="dropdown-trigger">{"\u29c9"}</div>
    <div class="dropdown-menu">
      <div class="dropdown-content">
        <div class="dropdown-item">{"Copy as\u2026"}</div>
        {Object.entries(formatters).map(([format, fn]) => {
          const eligible = !checks[format] || checks[format](beacon);

          if (eligible)
            return (
              <div
                class="dropdown-item"
                onClick={() => copyToClipboard(fn(beacon))}
              >
                {format}
              </div>
            );
          return null;
        })}
      </div>
    </div>
  </div>
);

const delimited = (delimiter: string, records: string[][]) =>
  records
    .map((row) =>
      row
        .map((cell) => {
          if (cell.indexOf(delimiter) >= 0 || cell.indexOf("\n") >= 0) {
            return `"${cell.replace(/"/g, '""').replace(/\n/g, "\\n")}"`;
          } else return cell;
        })
        .join(delimiter)
    )
    .join("\r\n");

const dsv = (delim: string, beacons: IBeaconSummary[]) => {
  const header = Object.keys(esMap);
  const rows = [header];

  beacons.forEach((beacon) => {
    const row: Record<string, string> = {};
    try {
      Object.entries(esMap).forEach(([outF, inF]) => {
        const val = beacon.payload.get(inF);

        switch (outF) {
          case "event":
            row["event_vendor"] = "com.snowplowanalytics.snowplow";
            row["event_format"] = "jsonschema";
            row["event_version"] = "1-0-0";

            console.log(outF, inF, val);

            switch (val) {
              case "pv":
                row["event_name"] = "page_view";
                row["event"] = "page_view";
                break;
              case "pp":
                row["event_name"] = "page_ping";
                row["event"] = "page_ping";
                break;
              case "tr":
                row["event_name"] = "transaction";
                row["event"] = "transaction";
                break;
              case "ti":
                row["event_name"] = "transaction_item";
                row["event"] = "transaction_item";
                break;
              case "se":
                row["event_name"] = "event";
                row["event"] = "struct";
                row["event_vendor"] = "com.google.analytics";
                break;
              case "ue":
                row["event_name"] = "unstruct";
                row["event"] = "unstruct";
                break;
              default:
                throw new Error("unserializable event format");
            }
            break;
          case "page_url":
          case "page_referrer":
            try {
              if (!val) return;
              const prefix = outF === "page_url" ? "page_" : "refr_";
              const uri = new URL(val);

              row[prefix + "urlscheme"] = uri.protocol.replace(":", "");
              row[prefix + "urlhost"] = uri.hostname;
              row[prefix + "urlport"] =
                uri.port || (uri.protocol === "https:" ? "443" : "80");
              row[prefix + "urlpath"] = uri.pathname;
              row[prefix + "urlquery"] = uri.search;
              row[prefix + "urlfragment"] = uri.hash;

              if (prefix === "page_") {
                ["source", "medium", "campaign", "content", "term"].forEach(
                  (param) => {
                    if (uri.searchParams.has("utm_" + param)) {
                      row["mkt_" + param] =
                        uri.searchParams.get("utm_" + param) || "";
                    }
                  }
                );

                Object.entries({
                  gclid: "Google",
                  msclkid: "Microsoft",
                  dclid: "DoubleClick",
                }).forEach(([param, network]) => {
                  if (uri.searchParams.has(param)) {
                    row["mkt_clickid"] = uri.searchParams.get(param) || "";
                    row["mkt_network"] = network;
                  }
                });
              } else {
                if (uri.searchParams.has("_sp")) {
                  const _sp = (uri.searchParams.get("_sp") || "").split(".");

                  if (_sp.length === 2) {
                    row["refr_domain_userid"] = _sp.shift()!;
                    const ts = new Date(+_sp.shift()!);
                    row["refr_device_tstamp"] = ts.toISOString();
                  }
                }
              }
            } catch (e) {}
            break;
          case "contexts":
            const contexts = tryb64(
              beacon.payload.get("cx") || beacon.payload.get("co") || ""
            );
            row[outF] = contexts;
            break;
          case "unstruct_event":
            const unstruct = tryb64(
              beacon.payload.get("ue_pr") || beacon.payload.get("ue_px") || ""
            );
            row[outF] = unstruct;

            try {
              const ue = JSON.parse(unstruct);
              if (
                typeof ue === "object" &&
                ue &&
                /\/unstruct_event\//.test(ue["schema"]) &&
                ue["data"]
              ) {
                const inner = ue["data"];
                if (inner.schema && /^iglu:/.test(inner.schema)) {
                  const uri = inner.schema;
                  const parts = uri.replace("iglu:", "").split("/");
                  if (parts.length === 4) {
                    row["event_vendor"] = parts[0];
                    row["event_name"] = parts[1];
                    row["event_format"] = parts[2];
                    row["event_version"] = parts[3];
                  }
                }
              }
            } catch (e) {}
            break;
          case "br_viewwidth":
          case "dvce_screenwidth":
          case "doc_width":
          case "br_viewheight":
          case "dvce_screenheight":
          case "doc_height":
            const pair = val?.split("x");

            if (pair && pair.length === 2) {
              row[outF] = outF.indexOf("width") === -1 ? pair[1] : pair[0];
            }
            break;
          case "dvce_created_tstamp":
          case "dvce_created_tstamp":
          case "dvce_sent_tstamp":
          case "true_tstamp":
            if (val) row[outF] = new Date(+val).toISOString();
            break;
          default:
            if (val != null) row[outF] = val;
        }
      });
    } catch (e) {
      return;
    }

    rows.push(header.map((field) => row[field] || ""));
  });

  return delimited(delim, rows);
};

const bulkFormatters: Record<string, (beacons: IBeaconSummary[]) => string> = {
  JSON: (beacons) =>
    JSON.stringify(
      beacons.map(({ payload }) => Object.fromEntries(payload.entries()))
    ),
  "JSON (Pretty)": (beacons) =>
    JSON.stringify(
      beacons.map(({ payload }) => Object.fromEntries(payload.entries())),
      null,
      4
    ),
  "JSON Sequence": (beacons) =>
    "\x1e" +
    beacons
      .map(({ payload }) =>
        JSON.stringify(Object.fromEntries(payload.entries()))
      )
      .join("\n\x1e") +
    "\n",
  "NDJSON / JSONL": (beacons) =>
    beacons
      .map(({ payload }) =>
        JSON.stringify(Object.fromEntries(payload.entries()))
      )
      .join("\n"),
  "Post Data": (beacons) =>
    JSON.stringify(
      wrapPost(
        beacons.map(({ payload }) => Object.fromEntries(payload.entries()))
      )
    ),
  CSV: dsv.bind(null, ","),
  TSV: dsv.bind(null, "\t"),
} as const;

export const BulkCopyMenu: FunctionComponent<{ events: IBeaconSummary[] }> = ({
  events,
}) => {
  const toggleCopyDisplay = ({
    currentTarget,
  }:
    | h.JSX.TargetedMouseEvent<HTMLButtonElement>
    | h.JSX.TargetedFocusEvent<HTMLButtonElement>) =>
    void currentTarget.parentElement!.parentElement!.classList.toggle(
      "is-active"
    );
  return (
    <p class="control dropdown">
      <div class="dropdown-trigger">
        <button
          type="button"
          class="button reveal"
          title="Copy As"
          onClick={toggleCopyDisplay}
          onBlur={toggleCopyDisplay}
        >
          {"\u29c9"}
        </button>
      </div>
      <div class="dropdown-menu">
        <div class="dropdown-content">
          {Object.entries(bulkFormatters).map(([format, fn]) => (
            <div
              class="dropdown-item"
              onMouseDown={(e) => {
                console.log("copying", format, events);
                e.preventDefault();
                copyToClipboard(fn(events));
              }}
            >
              {format}
            </div>
          ))}
        </div>
      </div>
    </p>
  );
};

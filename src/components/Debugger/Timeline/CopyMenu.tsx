import { h, type FunctionComponent } from "preact";
import { Copy } from "lucide-preact";

import type { IBeaconSummary } from "../../../ts/types";
import { copyToClipboard, tryb64 } from "../../../ts/util";

const wrapPost = (data: object) => {
  return {
    schema: "iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4",
    data: [data],
  };
};

const formatters: Record<string, (beacon: IBeaconSummary) => string> = {
  JSON: ({ payload }: IBeaconSummary) =>
    JSON.stringify(wrapPost(Object.fromEntries(payload.entries()))),
  "JSON (Pretty)": ({ payload }: IBeaconSummary) =>
    JSON.stringify(wrapPost(Object.fromEntries(payload.entries())), null, 4),
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
      lang && `-H "Accept-Language: ${JSON.stringify(lang)}`,
      `-H "Content-Type: application/json; charset=UTF-8"`,
      // double stringify to escape quotes properly
      `--data-raw ${JSON.stringify(JSON.stringify(wrapPost(data)))}`,
    ];

    return cmd.filter(Boolean).join(" \\\n  ");
  },
  "Snowplow CLI": ({ collector, payload }: IBeaconSummary) => {
    const aid = payload.get("aid");
    const ue = JSON.parse(
      tryb64(payload.get("ue_pr") || payload.get("ue_px") || "{}"),
    );
    const ctx = JSON.parse(
      tryb64(payload.get("co") || payload.get("cx") || "{}"),
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
}> = ({ beacon }) =>
  [
    <li key="hr">
      <hr />
    </li>,
    <li key="label" class="label">
      Copy as
    </li>,
  ].concat(
    Object.entries(formatters).flatMap(([format, formatter]) => {
      const eligible = !checks[format] || checks[format](beacon);
      return eligible
        ? [
            <li
              key={format}
              title={`Copy current event as ${format}`}
              onClick={({ currentTarget }) => {
                copyToClipboard(formatter(beacon));
                currentTarget.parentElement?.hidePopover();
              }}
              role="button"
              tabindex={0}
            >
              <Copy /> {format}
            </li>,
          ]
        : [];
    }),
  );

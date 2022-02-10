import { default as m, Component, ClosureComponent, Vnode } from "mithril";
import { protocol } from "../../ts/protocol";
import {
  IBeacon,
  IBeaconDetails,
  IBeaconSummary,
  IRowSet,
  FieldDetail,
} from "../../ts/types";
import {
  b64d,
  hasMembers,
  nameType,
  copyToClipboard,
  tryb64,
} from "../../ts/util";
import { IgluUri, IgluSchema, Resolver } from "../../ts/iglu";

type ProtocolField = typeof protocol.paramMap[keyof typeof protocol.paramMap];

function genClasses(finfo: ProtocolField): string {
  const classes = [];

  if (finfo.deprecated) {
    classes.push("deprecated");
  }

  return classes.join(" ");
}

function parseBeacon({
  collector,
  method,
  payload,
}: IBeaconSummary): IBeaconDetails {
  const result: IBeaconDetails = {
    appId: printableValue(payload.get("aid"), protocol.paramMap.aid),
    collector,
    data: [],
    method,
    name: payload.has("t")
      ? printableValue(payload.get("t"), protocol.gaMap.t)
      : printableValue(payload.get("e"), protocol.paramMap.e),
    time: printableValue(
      payload.get("stm") ||
        payload.get("dtm") ||
        (payload.get("_gid") || "").split(".").pop() ||
        undefined,
      protocol.paramMap.stm
    ),
    payload,
  };

  const seen = new Set<string>();

  if (payload.has("e")) {
    for (const gp of protocol.groupPriorities) {
      const name = gp.name;
      const fields = gp.fields;
      const rows: FieldDetail[] = [];

      for (const field of fields) {
        const finfo = protocol.paramMap[field];

        let val = payload.get(field);

        val = printableValue(val, finfo);

        if (val != null) {
          rows.push([finfo.name, val, genClasses(finfo)]);
          seen.add(field);
        }
      }

      if (rows.length) {
        result.data.push([name, rows]);
      }
    }
  }

  const unknownRows: FieldDetail[] = [];
  for (const [k, v] of payload) {
    if (!seen.has(k)) {
      unknownRows.push([k, v, "unknown"]);
    }
  }

  if (unknownRows.length) {
    result.data.push(["Unrecognised Fields", unknownRows]);
  }

  return result;
}

const labelType = (val: unknown) =>
  m(
    "button.typeinfo.button.is-pulled-right.is-info",
    {
      onclick: () => typeof val === "string" && copyToClipboard(val),
      title: "Click to copy",
    },
    nameType(val)
  );

type ValidityState = {
  validity: "Unrecognised" | "Valid" | "Invalid";
  errorText?: string;
  schema?: IgluSchema;
};

type BeaconValueAttrs = { obj: unknown; resolver: Resolver };

function isSDJ(obj: unknown): obj is { data: unknown; schema: string } {
  return (
    typeof obj === "object" && obj != null && "data" in obj && "schema" in obj
  );
}

const BeaconValue: ClosureComponent<BeaconValueAttrs> = () => {
  let schemaValidity: ValidityState | null = null;

  return {
    oninit: ({ attrs: { obj, resolver } }) => {
      if (isSDJ(obj)) {
        const schema = IgluSchema.fromUri(obj.schema as IgluUri);
        if (schema) {
          resolver
            .resolve(schema)
            .then(
              (schema): ValidityState => {
                const validation = schema.validate(obj.data);
                return validation.valid
                  ? {
                      validity: "Valid",
                      schema,
                    }
                  : {
                      validity: "Invalid",
                      errorText: validation.errors.join("\n"),
                      schema,
                    };
              },
              (): ValidityState => ({
                validity: "Unrecognised",
                errorText:
                  "Could not find or access schema definition in any configured repositories.",
                schema,
              })
            )
            .then((vs) => {
              schemaValidity = vs;
              m.redraw();
            });
        } else {
          schemaValidity = {
            validity: "Invalid",
            errorText: "Invalid Iglu URI identifying schema.",
          };
        }
      }
    },
    view: ({ attrs: { obj, resolver } }) => {
      if (typeof obj !== "object" || obj === null)
        return typeof obj === "undefined"
          ? obj
          : JSON.stringify(obj).replace(/^"|"$/g, "");

      const children: (Vnode<BeaconValueAttrs> | string)[] = [];
      let p;

      if (isSDJ(obj)) {
        if (isSDJ(obj.data)) {
          children.push(m(BeaconValue, { obj: obj.data, resolver }));
        } else if (typeof obj.data === "object" && obj.data !== null) {
          for (p in obj.data) {
            const nested = obj.data as { [f: string]: unknown };
            if (nested.hasOwnProperty(p)) {
              if (hasMembers(nested[p])) {
                children.push(
                  m("tr", [
                    m("th", p),
                    m("td", m(BeaconValue, { obj: nested[p], resolver })),
                  ])
                );
              } else {
                children.push(
                  m("tr", [
                    m("th", p),
                    m("td", [
                      labelType(nested[p]),
                      m(BeaconValue, { obj: nested[p], resolver }),
                    ]),
                  ])
                );
              }
            }
          }
        }

        const { validity, errorText } = schemaValidity || {
          validity: "Unrecognised",
        };

        return m(
          "div.card.iglu",
          { class: validity.toLowerCase() },
          m(
            "header.card-header",
            m("span.card-header-title", obj.schema),
            m("span.card-header-icon", "")
          ),
          m("div.card-content", m("table.table.is-fullwidth", children)),
          m(
            "footer.card-footer",
            m(
              "abbr.card-footer-item.validation",
              {
                onclick: () => {
                  if (validity === "Unrecognised") {
                    chrome.runtime.openOptionsPage();
                  } else if (errorText) {
                    copyToClipboard(errorText);
                  }
                },
                title: errorText,
              },
              validity
            ),
            m("textarea.card-footer-item[readonly]", {
              value: JSON.stringify(obj),
            })
          )
        );
      } else {
        const nested = obj as { [f: string]: unknown };
        for (p in nested) {
          if (obj.hasOwnProperty(p)) {
            if (hasMembers(nested[p])) {
              children.push(
                m("tr", [
                  m("th", p),
                  m("td", m(BeaconValue, { obj: nested[p], resolver })),
                ])
              );
            } else {
              children.push(
                m("tr", [
                  m("th", p),
                  m("td", [
                    labelType(nested[p]),
                    m(BeaconValue, { obj: nested[p], resolver }),
                  ]),
                ])
              );
            }
          }
        }

        return m("table.table.is-fullwidth", children);
      }
    },
  };
};

const RowSet: ClosureComponent<IRowSet> = () => {
  let visible = true;
  return {
    view: (vnode) =>
      m(
        "div.card.tile.is-child",
        { class: visible ? "show-rows" : "hide-rows" },
        m(
          "header.card-header",
          { onclick: () => (visible = !visible) },
          m("p.card-header-title", vnode.attrs.setName),
          m("a.card-header-icon", visible ? "[ - ]" : "[ + ]")
        ),
        m("div.card-content", m("table.table.is-fullwidth", vnode.children))
      ),
  };
};

const printableValue = (val: string | undefined, finfo: ProtocolField): any => {
  if (val === undefined || val === null || val === "") {
    return null;
  }

  switch (finfo.type) {
    case "text":
      return val;
    case "epoc":
      const ts = parseInt(val, 10);
      return new Date(ts < 10e9 ? ts * 1000 : ts).toISOString();
    case "numb":
      return parseInt(val, 10);
    case "doub":
      return parseFloat(val);
    case "bool":
      return val === "1";
    case "uuid":
      return val.toLowerCase();
    case "json":
      return JSON.parse(val);
    case "ba64":
      return printableValue(b64d(val), {
        name: finfo.name,
        type: finfo.then,
      } as ProtocolField);
    case "enum":
      return val;
    case "emap":
      return finfo.values[val] || val;
    default:
      return val;
  }
};

const wrapPost = (data: object) => {
  return {
    schema: "iglu:com.snowplowanalytics.snowplow/payload_data/jsonschema/1-0-4",
    data: [data],
  };
};

const copyMenu = (collector: string, beacon: IBeaconDetails["payload"]) =>
  beacon &&
  m(
    "div.dropdown.button.is-hoverable.is-up.is-dark",
    m("div.dropdown-trigger", "\u29c9"),
    m(
      "div.dropdown-menu",
      m("div.dropdown-content", [
        m("div.dropdown-item", "Copy as\u2026"),
        m(
          "a.dropdown-item",
          {
            onclick: () =>
              copyToClipboard(
                JSON.stringify(wrapPost(Object.fromEntries(beacon.entries())))
              ),
          },
          "JSON"
        ),
        m(
          "a.dropdown-item",
          {
            onclick: () =>
              copyToClipboard(
                JSON.stringify(
                  wrapPost(Object.fromEntries(beacon.entries())),
                  null,
                  4
                )
              ),
          },
          "JSON (pretty)"
        ),
        m(
          "a.dropdown-item",
          {
            onclick: () => {
              const u = new URL(`https://${collector}/i`);
              beacon.forEach((v, k) => u.searchParams.append(k, v));
              copyToClipboard(u.href);
            },
          },
          "URL - GET"
        ),
        m(
          "a.dropdown-item",
          {
            onclick: () => {
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
            },
          },
          "cURL"
        ),
        beacon.get("e") == "ue"
          ? m(
              "a.dropdown-item",
              {
                onclick: () => {
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
                },
              },
              "Snowplow CLI"
            )
          : undefined,
      ])
    )
  );

const formatBeacon = (
  { appId, name, time, collector, method, data, payload }: IBeaconDetails,
  resolver: Resolver
) =>
  [
    m("div.level.box", [
      m(
        "div.level-item.has-text-centered",
        m("div", [m("p.heading", "App"), m("p.title", appId)])
      ),
      m(
        "div.level-item.has-text-centered",
        m("div", [m("p.heading", "Event"), m("p.title", name)])
      ),
    ]),
    m("div.level.box", [
      m(
        "div.level-item.has-text-centered",
        m("div", [
          m("p.heading", "Time"),
          m("time.title", { datetime: time }, new Date(time).toUTCString()),
        ])
      ),
    ]),
    m("div.level.box", [
      m(
        "div.level-item.has-text-centered",
        m("div", [m("p.heading", "collector"), m("p.title", collector)])
      ),
      m(
        "div.level-item.has-text-centered",
        m("div", [m("p.heading", "Method"), m("p.title", method)])
      ),
    ]),
    copyMenu(collector, payload),
  ].concat(
    data.map(([setName, rows]) =>
      m(
        RowSet,
        { setName },
        rows.map(([name, val, classes]) =>
          !/Custom Context|(Unstructured|Self-Describing) Event/.test(name)
            ? m("tr", { class: classes }, [
                m("th", name),
                m("td", [
                  labelType(val),
                  m(BeaconValue, { obj: val, resolver }),
                ]),
              ])
            : m(BeaconValue, { obj: val, resolver })
        )
      )
    )
  );

export const Beacon: Component<IBeacon> = {
  view: ({ attrs: { activeBeacon, resolver } }) =>
    activeBeacon && formatBeacon(parseBeacon(activeBeacon), resolver),
};

import { h, FunctionComponent, Fragment, VNode } from "preact";
import { useMemo, useState } from "preact/hooks";

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

const LabelType: FunctionComponent<{ val: unknown }> = ({ val }) => (
  <button
    class="button typeinfo is-pulled-right is-info"
    title="Click to copy"
    onClick={() => typeof val === "string" && copyToClipboard(val)}
  >
    {nameType(val)}
  </button>
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

const BeaconValue: FunctionComponent<BeaconValueAttrs> = ({
  obj,
  resolver,
}) => {
  const [schemaValidity, setSchemaValidity] = useState<ValidityState | null>(
    null
  );

  const validityCheck = useMemo((): Promise<ValidityState | null> => {
    if (!schemaValidity && isSDJ(obj)) {
      const schema = IgluSchema.fromUri(obj.schema as IgluUri);
      if (schema) {
        return resolver.resolve(schema).then(
          (schema) => {
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
          () => ({
            validity: "Unrecognised",
            errorText:
              "Could not find or access schema definition in any configured repositories.",
            schema,
          })
        );
      } else {
        return Promise.resolve({
          validity: "Invalid",
          errorText: "Invalid Iglu URI identifying schema.",
        });
      }
    } else return Promise.resolve(null);
  }, [obj, resolver, schemaValidity]);

  if (typeof obj !== "object" || obj === null) {
    switch (typeof obj) {
      case "undefined":
        return null;
      case "string":
        try {
          const json = JSON.parse(obj);
          return <BeaconValue resolver={resolver} obj={json} />;
        } catch (e) {
          return <>{obj}</>;
        }
      default:
        return <>{JSON.stringify(obj)}</>;
    }
  }

  const children: (VNode<BeaconValueAttrs> | string)[] = [];
  let p;
  if (isSDJ(obj)) {
    if (!schemaValidity)
      validityCheck.then((validity) => {
        setSchemaValidity((orig) => {
          return orig || validity;
        });
      });

    if (isSDJ(obj.data)) {
      children.push(<BeaconValue obj={obj.data} resolver={resolver} />);
    } else if (typeof obj.data === "object" && obj.data !== null) {
      for (p in obj.data) {
        const nested = obj.data as { [f: string]: unknown };
        if (nested.hasOwnProperty(p)) {
          if (hasMembers(nested[p])) {
            children.push(
              <tr>
                <th>{p}</th>
                <td>
                  <BeaconValue obj={nested[p]} resolver={resolver} />
                </td>
              </tr>
            );
          } else {
            children.push(
              <tr>
                <th>{p}</th>
                <td>
                  <LabelType val={nested[p]} />
                  <BeaconValue obj={nested[p]} resolver={resolver} />
                </td>
              </tr>
            );
          }
        }
      }
    }

    const { validity, errorText } = schemaValidity || {
      validity: "Unrecognised",
    };

    return (
      <div class={["card", "iglu", validity.toLowerCase()].join(" ")}>
        <header class="card-header">
          <span class="card-header-title">{obj.schema}</span>
          <span class="card-header-icon" />
        </header>
        <div class="card-content">
          <table class="table is-fullwidth">{children}</table>
        </div>
        <footer class="card-footer">
          <abbr
            class="card-footer-item validation"
            title={errorText}
            onClick={() => {
              if (validity === "Unrecognised") {
                chrome.runtime.openOptionsPage();
              } else if (errorText) {
                copyToClipboard(errorText);
              }
            }}
          >
            {validity}
          </abbr>
          <textarea
            class="card-footer-item"
            readOnly
            value={JSON.stringify(obj)}
          />
        </footer>
      </div>
    );
  } else {
    const nested = obj as { [f: string]: unknown };
    for (p in nested) {
      if (obj.hasOwnProperty(p)) {
        if (hasMembers(nested[p])) {
          children.push(
            <tr>
              <th>{p}</th>
              <td>
                <BeaconValue obj={nested[p]} resolver={resolver} />
              </td>
            </tr>
          );
        } else {
          children.push(
            <tr>
              <th>{p}</th>
              <td>
                <LabelType val={nested[p]} />
                <BeaconValue obj={nested[p]} resolver={resolver} />
              </td>
            </tr>
          );
        }
      }
    }

    return <table class="table is-fullwidth">{children}</table>;
  }
};

const RowSet: FunctionComponent<IRowSet> = ({ setName, children }) => {
  const [visible, setVisible] = useState(true);
  return (
    <div
      class={[
        "card",
        "tile",
        "is-child",
        visible ? "show-rows" : "hide-rows",
      ].join(" ")}
    >
      <header
        class="card-header"
        onClick={() => setVisible((visible) => !visible)}
      >
        <p class="card-header-title">{setName}</p>
        <p class="card-header-icon">{visible ? "[ - ]" : "[ + ]"}</p>
      </header>
      <div class="card-content">
        <table class="table is-fullwidth">{children}</table>
      </div>
    </div>
  );
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

const CopyMenu: FunctionComponent<{
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

const formatBeacon = (
  { appId, name, time, collector, method, data, payload }: IBeaconDetails,
  resolver: Resolver
) => (
  <>
    <div class="level box">
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">App</p>
          <p class="title">{appId}</p>
        </div>
      </div>
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">Event</p>
          <p class="title">{name}</p>
        </div>
      </div>
    </div>
    <div class="level box">
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">Time</p>
          <time class="title" dateTime={time}>
            {new Date(time).toUTCString()}
          </time>
        </div>
      </div>
    </div>
    <div class="level box">
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">Collector</p>
          <p class="title">{collector}</p>
        </div>
      </div>
      <div class="level-item has-text-centered">
        <div>
          <p class="heading">Method</p>
          <p class="title">{method}</p>
        </div>
      </div>
    </div>
    <CopyMenu collector={collector} beacon={payload} />
    {data.map(([setName, rows]) => (
      <RowSet setName={setName}>
        {rows.map(([name, val, classes]) =>
          !/Custom Context|(Unstructured|Self-Describing) Event/.test(name) ? (
            <tr class={classes}>
              <th>{name}</th>
              <td>
                <LabelType val={val} />
                <BeaconValue obj={val} resolver={resolver} />
              </td>
            </tr>
          ) : (
            <BeaconValue obj={val} resolver={resolver} />
          )
        )}
      </RowSet>
    ))}
  </>
);

export const Beacon: FunctionComponent<IBeacon> = ({
  activeBeacon,
  resolver,
}) => (
  <>{!!activeBeacon && formatBeacon(parseBeacon(activeBeacon), resolver)}</>
);

import { h, FunctionComponent, Fragment, VNode } from "preact";
import { useEffect, useState } from "preact/hooks";

import { protocol } from "../../ts/protocol";
import {
  IBeacon,
  IBeaconDetails,
  IBeaconSummary,
  IRowSet,
  FieldDetail,
} from "../../ts/types";
import { b64d, hasMembers, nameType, copyToClipboard } from "../../ts/util";
import { IgluUri, IgluSchema, Resolver } from "../../ts/iglu";
import { LocalRegistry } from "../../ts/iglu/Registries";

import { ModalSetter } from "../Modals";

import { CopyMenu } from "./CopyMenu";

type ProtocolField = (typeof protocol.paramMap)[keyof typeof protocol.paramMap];

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

type BeaconValueAttrs = {
  obj: unknown;
  resolver: Resolver;
  setModal?: ModalSetter;
};

function isSDJ(obj: unknown): obj is { data: unknown; schema: string } {
  return (
    typeof obj === "object" && obj != null && "data" in obj && "schema" in obj
  );
}

const BeaconValue: FunctionComponent<BeaconValueAttrs> = ({
  obj,
  resolver,
  setModal,
}) => {
  const [{ validity, errorText }, setSchemaValidity] = useState<ValidityState>({
    validity: "Unrecognised",
  });

  useEffect(() => {
    if (isSDJ(obj)) {
      const schema = IgluSchema.fromUri(obj.schema as IgluUri);
      if (schema) {
        resolver
          .resolve(schema)
          .then<ValidityState, ValidityState>(
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
          )
          .then(setSchemaValidity);
      } else {
        setSchemaValidity({
          validity: "Invalid",
          errorText: "Invalid Iglu URI identifying schema.",
        });
      }
    }
  }, [obj, resolver, resolver.registries.length]);

  if (typeof obj !== "object" || obj === null) {
    switch (typeof obj) {
      case "undefined":
        return null;
      case "string":
        try {
          const json = JSON.parse(obj);
          return (
            <BeaconValue resolver={resolver} obj={json} setModal={setModal} />
          );
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
    if (isSDJ(obj.data)) {
      children.push(
        <BeaconValue obj={obj.data} resolver={resolver} setModal={setModal} />
      );
    } else if (typeof obj.data === "object" && obj.data !== null) {
      for (p in obj.data) {
        const nested = obj.data as { [f: string]: unknown };
        if (nested.hasOwnProperty(p)) {
          if (hasMembers(nested[p])) {
            children.push(
              <tr>
                <th>{p}</th>
                <td>
                  <BeaconValue
                    obj={nested[p]}
                    resolver={resolver}
                    setModal={setModal}
                  />
                </td>
              </tr>
            );
          } else {
            children.push(
              <tr>
                <th>{p}</th>
                <td>
                  <LabelType val={nested[p]} />
                  <BeaconValue
                    obj={nested[p]}
                    resolver={resolver}
                    setModal={setModal}
                  />
                </td>
              </tr>
            );
          }
        }
      }
    }

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
              if (validity === "Unrecognised" && setModal) {
                const newReg = new LocalRegistry({
                  kind: "local",
                  name: "My New Registry",
                });
                setModal("editRegistries", {
                  registries: [newReg],
                  resolver,
                });
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
                <BeaconValue
                  obj={nested[p]}
                  resolver={resolver}
                  setModal={setModal}
                />
              </td>
            </tr>
          );
        } else {
          children.push(
            <tr>
              <th>{p}</th>
              <td>
                <LabelType val={nested[p]} />
                <BeaconValue
                  obj={nested[p]}
                  resolver={resolver}
                  setModal={setModal}
                />
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

const BeaconHeader: FunctionComponent<
  Omit<IBeaconDetails, "data" | "payload"> & {
    compact: boolean;
    resolver: Resolver;
  }
> = ({ appId, collector, compact, method, name, resolver, time }) => {
  const dt = new Date(time);
  return compact ? (
    <RowSet setName="Core">
      <tr>
        <th>App</th>
        <td>
          <LabelType val={appId} />
          <BeaconValue obj={appId} resolver={resolver} />
        </td>
      </tr>
      <tr>
        <th>Event</th>
        <td>
          <BeaconValue obj={name} resolver={resolver} />
        </td>
      </tr>
      <tr>
        <th>Time</th>
        <td>
          <time
            dateTime={dt.toISOString()}
            title={dt.toLocaleString(undefined, {
              dateStyle: "full",
              timeStyle: "full",
            })}
          >
            {dt.toUTCString()}
          </time>
        </td>
      </tr>
      <tr>
        <th>Collector</th>
        <td>
          <BeaconValue obj={collector} resolver={resolver} />
        </td>
      </tr>
      <tr>
        <th>Method</th>
        <td>
          <BeaconValue obj={method} resolver={resolver} />
        </td>
      </tr>
    </RowSet>
  ) : (
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
            <time
              class="title"
              dateTime={dt.toISOString()}
              title={dt.toLocaleString(undefined, {
                dateStyle: "full",
                timeStyle: "full",
              })}
            >
              {dt.toUTCString()}
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
    </>
  );
};
const formatBeacon = (
  { collector, data, payload, ...info }: IBeaconDetails,
  resolver: Resolver,
  setModal: ModalSetter,
  compact = false
) => (
  <>
    <BeaconHeader
      compact={compact}
      resolver={resolver}
      collector={collector}
      {...info}
    />
    {data.map(([setName, rows]) => (
      <RowSet key={setName} setName={setName}>
        {rows.map(([name, val, classes]) =>
          !/Custom Entity|(Unstructured|Self-Describing) Event/.test(name) ? (
            <tr class={classes}>
              <th>{name}</th>
              <td>
                <LabelType val={val} />
                <BeaconValue
                  obj={val}
                  resolver={resolver}
                  setModal={setModal}
                />
              </td>
            </tr>
          ) : (
            <BeaconValue obj={val} resolver={resolver} setModal={setModal} />
          )
        )}
      </RowSet>
    ))}
  </>
);

export const Beacon: FunctionComponent<IBeacon> = ({
  activeBeacon,
  resolver,
  compact,
  setModal,
}) =>
  activeBeacon ? (
    <>
      {formatBeacon(parseBeacon(activeBeacon), resolver, setModal, compact)}
      <CopyMenu beacon={activeBeacon} />
    </>
  ) : null;

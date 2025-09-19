import { h, type FunctionComponent, Fragment, type VNode } from "preact";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { protocol } from "../../../ts/protocol";
import type {
  IBeacon,
  IBeaconDetails,
  IBeaconSummary,
  IRowSet,
  FieldDetail,
  PipelineInfo,
} from "../../../ts/types";
import { b64d, colorOf, copyToClipboard, nameType } from "../../../ts/util";
import {
  type IgluUri,
  IgluSchema,
  ResolvedIgluSchema,
  Resolver,
} from "../../../ts/iglu";

import type { ModalSetter } from "../../Modals";

import { CopyMenu } from "../CopyMenu";

import "./EventPayload.css";

type ProtocolField = (typeof protocol.paramMap)[keyof typeof protocol.paramMap];

function genClasses(finfo: ProtocolField): string {
  const classes = [];

  if (finfo.deprecated) {
    classes.push("deprecated");
  }

  return classes.join(" ");
}

function destructureEvent({
  collector,
  method,
  payload,
  serverAnonymous,
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
      protocol.paramMap.stm,
    ),
    payload,
    serverAnonymous,
  };

  const seen = new Set<string>();

  if (payload.has("e")) {
    for (const gp of protocol.groupPriorities) {
      const { name, fields } = gp;
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

      if (name === "User") {
        rows.push([
          "Server Anonymization",
          serverAnonymous ? "Enabled" : "Disabled",
          "",
        ]);
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
    class={[
      "typeinfo",
      "typeinfo--" + nameType(val).split(" ").shift()?.toLowerCase(),
    ].join(" ")}
    type="button"
    title="Click to copy value"
    onClick={() =>
      copyToClipboard(typeof val === "string" ? val : JSON.stringify(val))
    }
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

const Tabs = <T extends Record<string, () => VNode>>({
  options,
  defaultTab,
  name,
}: {
  options: T;
  defaultTab: keyof T;
  name: string;
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const tabHandler = useCallback((e: Event) => {
    const { target } = e;
    if (target instanceof HTMLInputElement) {
      e.stopPropagation();
      setActiveTab(target.value as typeof activeTab);
    }
  }, []);

  return (
    <>
      <form class="iglu__tabs-control" onChange={tabHandler}>
        {Object.keys(options).map((tabName) => (
          <label
            class={["tab", activeTab === tabName ? "tab--active" : ""].join(
              " ",
            )}
          >
            <input
              type="radio"
              name={name}
              value={tabName}
              checked={activeTab === tabName}
            />
            {tabName}
          </label>
        ))}
      </form>
      <div
        class={["iglu__payload", "iglu__payload--" + activeTab.toString()].join(
          " ",
        )}
      >
        {options[activeTab]()}
      </div>
    </>
  );
};

const SDJValue: FunctionComponent<BeaconValueAttrs> = ({
  obj,
  resolver,
  setModal,
}) => {
  if (!isSDJ(obj)) return null;

  const [schemaValidity, setSchemaValidity] = useState<ValidityState>({
    validity: "Unrecognised",
  });

  useEffect(() => {
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
          }),
        )
        .then(setSchemaValidity);
    } else {
      setSchemaValidity({
        validity: "Invalid",
        errorText: "Invalid Iglu URI identifying schema.",
      });
    }
  }, [obj, resolver]);

  const children: (VNode<BeaconValueAttrs> | string)[] = [];

  if (isSDJ(obj.data)) {
    children.push(
      <SDJValue obj={obj.data} resolver={resolver} setModal={setModal} />,
    );
  } else if (typeof obj.data === "object" && obj.data !== null) {
    children.push(
      ...Object.entries(obj.data).map(([p, val]) => (
        <tr>
          <th>{p}</th>
          <td>
            <BeaconValue obj={val} resolver={resolver} setModal={setModal} />
            {isSDJ(val) ? null : <LabelType val={val} />}
          </td>
        </tr>
      )),
    );
  }

  const { validity, errorText, schema } = schemaValidity;

  const tabs = {
    Data: () => (
      <>
        <table class={Array.isArray(obj.data) ? "array" : "object"}>
          {children}
        </table>
        <LabelType val={obj.data} />
      </>
    ),
    JSON: () => {
      const jsonText = JSON.stringify(obj, null, 2);
      const lineCounter = jsonText.match(/\n/g) || [];
      return (
        <textarea readOnly value={jsonText} rows={lineCounter.length + 1} />
      );
    },
    Schema: () => {
      const resolved =
        schema instanceof ResolvedIgluSchema ? schema.data : schema || {};
      const jsonText = JSON.stringify(resolved, null, 2);
      const lineCounter = jsonText.match(/\n/g) || [];
      return (
        <textarea readOnly value={jsonText} rows={lineCounter.length + 1} />
      );
    },
    Errors: () => (
      <ul>
        {(errorText || "No errors found").split("\n").map((text) => (
          <li>{text}</li>
        ))}
      </ul>
    ),
  };

  return (
    <details class={["iglu", "iglu--" + validity.toLowerCase()].join(" ")} open>
      <summary>
        {obj.schema}
        <abbr
          class="iglu__validation"
          title={errorText}
          onClick={() => {
            if (errorText) {
              copyToClipboard(errorText);
            }
          }}
        >
          {validity}
        </abbr>
      </summary>
      <Tabs defaultTab="Data" options={tabs} name="format" />
    </details>
  );
};

const BeaconValue: FunctionComponent<BeaconValueAttrs> = ({
  obj,
  resolver,
  setModal,
}) => {
  if (typeof obj !== "object" || obj === null) {
    switch (typeof obj) {
      case "undefined":
        return null;
      case "string":
        try {
          const json = JSON.parse(obj);
          if (typeof json !== "object")
            throw Error("Simple JSON value can be displayed normally");
          return (
            <BeaconValue resolver={resolver} obj={json} setModal={setModal} />
          );
        } catch (e) {
          return <span>{obj}</span>;
        }
      default:
        return <span>{JSON.stringify(obj)}</span>;
    }
  } else if (!isSDJ(obj)) {
    return (
      <table class={Array.isArray(obj) ? "array" : "object"}>
        {Object.entries(obj).map(([p, val]) => (
          <tr>
            <th>{p}</th>
            <td>
              <BeaconValue obj={val} resolver={resolver} setModal={setModal} />
              <LabelType val={val} />
            </td>
          </tr>
        ))}
      </table>
    );
  } else return <SDJValue obj={obj} resolver={resolver} />;
};

const FieldGroup: FunctionComponent<IRowSet> = ({ setName, children }) => (
  <details class="event-fieldgroup" open>
    <summary>{setName}</summary>
    <table>{children}</table>
  </details>
);

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

const EventSummary: FunctionComponent<
  Omit<IBeaconDetails, "data" | "payload"> & {
    resolver: Resolver;
  }
> = ({
  appId,
  children,
  collector,
  method,
  name,
  resolver,
  serverAnonymous,
  time,
}) => {
  const dt = new Date(time);
  const anonDesc = [
    "This event was sent in a request with the SP-Anonymous header.",
    "The detected IP and Network User ID will not be included in the payload processed by Enrich.",
  ].join("\n ");

  return (
    <article class={`event-payload destination-${colorOf(collector + appId)}`}>
      <header>
        <h1>{name} Event</h1>
        <span>
          Method: <span>{method}</span>
        </span>
      </header>
      <main>
        <aside>
          <dl>
            <dt>Collector:</dt>
            <dd>{collector}</dd>
            <dt>Time:</dt>
            <dd>
              <time dateTime={dt.toISOString()} title={dt.toUTCString()}>
                {dt.toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "medium",
                })}
              </time>
            </dd>
            <dt>App:</dt>
            <dd>
              <BeaconValue obj={appId} resolver={resolver} />
              <LabelType val={appId} />
            </dd>
            {serverAnonymous && [
              <dt title={anonDesc}>Server Anonymization</dt>,
              <dd>
                <BeaconValue obj={serverAnonymous} resolver={resolver} />
              </dd>,
            ]}
          </dl>
        </aside>
        <ul>{children}</ul>
      </main>
    </article>
  );
};

const PipelineDetails: FunctionComponent<{
  pipeline: PipelineInfo;
  resolver: Resolver;
  setModal: ModalSetter;
}> = ({ pipeline, resolver, setModal }) => {
  return (
    <FieldGroup key="pipeline" setName="Pipeline Configuration">
      {Object.entries({
        "Pipeline Name": pipeline.domain,
        Organization: pipeline.organizationName,
        "Organization ID": pipeline.organization,
        "Cloud Provider": pipeline.cloudProvider,
        Type: pipeline.resource === "minis" ? "Mini" : "Full Pipeline",
      }).map(([name, val]) => (
        <tr>
          <th>{name}</th>
          <td>
            <BeaconValue obj={val} resolver={resolver} setModal={setModal} />
            <LabelType val={val} />
          </td>
        </tr>
      ))}
      <tr>
        <th>Enrichments</th>
        <td>
          <details>
            {pipeline.enrichments
              .sort((a, b) =>
                a.enabled > b.enabled
                  ? -1
                  : a.enabled < b.enabled
                    ? 1
                    : a.filename < b.filename
                      ? -1
                      : 1,
              )
              .map((enr) => (
                <BeaconValue
                  obj={
                    enr.content || {
                      schema: `iglu:com.snowplowanalytics.snowplow/${enr.filename.replace(
                        ".json",
                        "",
                      )}/jsonschema/1-0-0`,
                      data: {
                        name: enr.filename,
                        enabled: enr.enabled,
                        sensitive:
                          "This configuration is unavailable as it may contain sensitive values.",
                      },
                    }
                  }
                  resolver={resolver}
                  setModal={setModal}
                />
              ))}
          </details>
        </td>
      </tr>
    </FieldGroup>
  );
};

export const EventPayload: FunctionComponent<IBeacon> = ({
  activeBeacon,
  pipelines,
  resolver,
  setModal,
}) => {
  const { collector, data, payload, ...info } = destructureEvent(activeBeacon);

  const pipeline = useMemo(
    () =>
      pipelines.find(
        (line) => !!line.domains.find((dom) => dom.endsWith(collector)),
      ),
    [pipelines, collector],
  );

  return (
    <>
      <EventSummary resolver={resolver} collector={collector} {...info}>
        {pipeline && (
          <PipelineDetails
            key="pipeline"
            {...{ pipeline, resolver, setModal }}
          />
        )}
        {data.map(([setName, rows]) => (
          <li>
            <FieldGroup key={setName} setName={setName}>
              {rows.map(([name, val, classes]) =>
                !/Custom Entity|(Unstructured|Self-Describing|SD) Event/.test(
                  name,
                ) ? (
                  <tr class={classes}>
                    <th>{name}</th>
                    <td>
                      <BeaconValue obj={val} {...{ resolver, setModal }} />
                      <LabelType val={val} />
                    </td>
                  </tr>
                ) : (
                  <BeaconValue obj={val} {...{ resolver, setModal }} />
                ),
              )}
            </FieldGroup>
          </li>
        ))}
      </EventSummary>
      <CopyMenu beacon={activeBeacon} />
    </>
  );
};

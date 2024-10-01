import { Cookie, Entry, Header, Request } from "har-format";
import { Schema } from "jsonschema";

import { protocol } from "./protocol";
import { schemas, decodeB64Thrift } from "./thriftcodec";
import {
  ITomcatImport,
  NgrokEvent,
  TestSuiteCondition,
  TestSuiteSpec,
} from "./types";

/*
  This looks for requests matching known Snowplow endpoints.
  If a POST request doesn't match the pattern, it is still "sniffed" for a Snowplow
  payload, in the event of Custom Post paths.

  TODO(jethron): Make custom paths configurable:-
  There is an issue where beacon requests (POSTs) fired on page navigation sometimes
  have no body; the Content-Length header suggests there should be one but it is inaccessible.
  This makes the hit undetectable to the sniffing above. Custom paths should be
  configurable to catch these cases.

  /i is the traditional "ice" request for GET
  /com.snowplowanalytics.snowplow/tp2 is the default POST parameter endpoint
  /collector/tp2 is a special case for a particular collector using beacon requests (Magento/Adobe: see #44)
 */
const spPattern =
  /^[^:]+:\/\/[^/?#;]+(\/[^/]+)*?\/(i\?(tv=|.*&tv=)|(com\.snowplowanalytics\.snowplow|collector)\/tp2)/i;
const plPattern = /^iglu:[^\/]+\/payload_data/i;
const gaPattern = /\/com\.google\.analytics\/v1/i;

const isSnowplow = (request: Request): boolean => {
  if (spPattern.test(request.url) || gaPattern.test(request.url)) {
    return true;
  } else {
    // It's possible that the request uses a custom endpoint via postPath
    if (request.method === "POST" && typeof request.postData !== "undefined") {
      // Custom endpoints only support POST requests
      try {
        const post = JSON.parse(request.postData.text!) || {};
        return (
          typeof post === "object" &&
          "schema" in post &&
          plPattern.test(post.schema)
        );
      } catch {
        // invalid JSON, not a Snowplow event
      }
    }
  }

  return false;
};

type ScenarioTrigger = {
  description: string;
  appIds?: string[];
  url?: string;
  variantUrls?: {
    original: string;
    thumbnail: string;
  };
};

type TrackingScenario = {
  id: string;
  message: string;
  date: string;
  version: number;
  status: "draft" | "published" | "deprecated";
  name: string;
  author: string;
  owner?: string;
  dataProductId?: string;
  description?: string;
  appIds?: string[];
  triggers?: ScenarioTrigger[];
  event?: {
    source: string;
    schema?: Schema;
  };
  entities?: {
    tracked?: {
      source: string;
      minCardinality?: number;
      maxCardinality?: number;
    }[];
    enriched?: {
      source: string;
      minCardinality?: number;
      maxCardinality?: number;
    }[];
  };
};

const specFromTrackingScenario = (
  scenario: TrackingScenario,
): TestSuiteSpec => {
  const triggers = scenario.triggers || [];
  const triggerText = triggers.length
    ? "Should trigger when:\n- " +
      triggers.map((trigger) => trigger.description).join("\n- ")
    : "";

  let uncheckableWarning = "";
  if (scenario.entities && scenario.entities.enriched) {
    uncheckableWarning =
      "Entities added during enrichment will not be validated.";
  }

  const description = `${scenario.description || "No description found."}

  ${triggerText}

  ${uncheckableWarning}

  Tracking Scenario Information:
  Version: ${scenario.version}
  Status: ${scenario.status}
  Last Modified: ${scenario.date}
  Owner: ${scenario.owner || "Nobody"}
  Scenario ID: ${scenario.id}
  Author ID: ${scenario.author}
  Message: ${scenario.message}
  `;

  const targets: TestSuiteSpec["targets"] = [];
  const conditions: TestSuiteCondition[] = [];

  if (scenario.appIds && scenario.appIds.length) {
    targets.push({
      type: "condition",
      operator: "one_of",
      value: scenario.appIds,
      target: "payload.aid",
      description: "Scenario applies to specific App IDs.",
    });
  }

  if (scenario.event) {
    const { source, schema } = scenario.event;
    const [vendor, name, format, version] = source
      .replace("iglu:", "")
      .replace(/\./g, "_")
      .split("/");

    targets.push({
      type: "condition",
      operator: "exists",
      target: `payload.unstruct.${vendor}.${name}`,
    });
    conditions.push(
      {
        type: "condition",
        operator: "equals",
        target: `payload.unstruct.${vendor}.${name}.$format`,
        value: format,
      },
      {
        type: "condition",
        operator: "equals",
        target: `payload.unstruct.${vendor}.${name}.$version`,
        value: version,
      },
    );

    if (schema) {
      targets.push({
        type: "condition",
        operator: "validates",
        target: `payload.unstruct.${vendor}.${name}.[0]`,
        value: schema,
      });
    }
  }

  (scenario.entities?.tracked || []).forEach(
    ({ source, minCardinality, maxCardinality }) => {
      const [vendor, name, format, version] = source
        .replace("iglu:", "")
        .replace(/\./g, "_")
        .split("/");

      conditions.push({
        type: "condition",
        operator: "exists",
        target: `payload.context.${vendor}.${name}`,
      });

      if (minCardinality) {
        for (let i = 0; i < minCardinality; i++) {
          conditions.push({
            type: "condition",
            operator: "exists",
            target: `payload.context.${vendor}.${name}.[${i}]`,
            description: `Check ${vendor}/${name} minCardinality of ${minCardinality}`,
          });
        }
      }

      if (maxCardinality) {
        conditions.push({
          type: "condition",
          operator: "not_exists",
          target: `payload.context.${vendor}.${name}.[${maxCardinality + 1}]`,
          description: `Check ${vendor}/${name} maxCardinality of ${maxCardinality}`,
        });
      }
    },
  );

  return {
    type: "case",
    combinator: "and",
    name: scenario.name,
    description,
    targets,
    conditions,
  };
};

const specFromTrackingScenarios = (
  name: string,
  scenarios: TrackingScenario[],
): TestSuiteSpec => {
  const DEFAULT_GROUP = "ungrouped";
  const groups: Record<string, TrackingScenario[]> = {};
  scenarios.forEach((s) => {
    const group = s.dataProductId || DEFAULT_GROUP;
    if (!groups[group]) groups[group] = [];
    groups[group].push(s);
  });

  const tests = Object.entries(groups).flatMap(
    ([group, items]): TestSuiteSpec[] => {
      if (group === DEFAULT_GROUP) {
        return items.map(specFromTrackingScenario);
      } else {
        return [
          {
            type: "group",
            name: group,
            description: `Tracking Scenarios for the ${group} Data Product.`,
            tests: items.map(specFromTrackingScenario),
            combinator: "and",
          },
        ];
      }
    },
  );

  return {
    name: `${name} Scenarios`,
    description: `Tests generated from tracking scenarios defined in the ${name} console.`,
    type: "group",
    combinator: "and",
    tests,
  };
};

const uuidv4 = (): string =>
  crypto.randomUUID
    ? crypto.randomUUID()
    : "00000000-0000-4000-8000-000000000000".replace(/0/g, () =>
        Math.floor(Math.random() * 17).toString(16),
      );

const hash = (bytes: string): string => {
  let h = 5381;

  for (let i = 0; i < bytes.length; i++) {
    h = (h << 5) + h + bytes.charCodeAt(i);
  }

  return String(h);
};

const objHasProperty = <T extends {}, K extends PropertyKey>(
  obj: T,
  prop: K,
): obj is T & Record<K, unknown> => obj.hasOwnProperty(prop);

const hasMembers = (obj: unknown) => {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  if (Array.isArray(obj) && obj.length > 0) {
    return true;
  }

  for (const p in obj) {
    if (obj.hasOwnProperty(p)) {
      return true;
    }
  }

  return false;
};

const b64d = (s: string): string => {
  try {
    const bytes = atob(s.replace(/-/g, "+").replace(/_/g, "/"));

    try {
      // UTF-8 decode bytestring
      return decodeURIComponent(escape(bytes));
    } catch (e) {
      return bytes;
    }
  } catch (e) {
    console.log(e);
    return "";
  }
};

const nameType = (val: unknown) => {
  if (val === null) {
    return "null";
  }
  if (Array.isArray(val)) {
    return val.length ? "array" : "array (Empty)";
  }
  if (typeof val === "number" && isNaN(val)) {
    return "number (NaN)";
  }
  if (typeof val === "number" && !isFinite(val)) {
    return "number (Infinite)";
  }
  if (val instanceof RegExp) {
    return "RegExp";
  }
  if (val instanceof Date) {
    return "Date";
  }
  if (val instanceof Promise) {
    return "Promise";
  }
  return typeof val;
};

const copyToClipboard = (text: string): void => {
  let cb = document.getElementById("clipboard") as HTMLTextAreaElement;
  if (cb === null) {
    cb = document.createElement("textarea") as HTMLTextAreaElement;
    cb.id = "clipboard";
    document.body.appendChild(cb);
  }

  cb.value = typeof text === "string" ? text : JSON.stringify(text);
  cb.select();
  document.execCommand("copy");
};

const tryb64 = (text: string): string => {
  if (
    typeof text === "string" &&
    /^([A-Za-z0-9/_+-]{4})+([A-Za-z0-9/_+=-]{1,4})?$/.test(text)
  ) {
    return b64d(text);
  } else {
    return text;
  }
};

// Formats: https://github.com/snowplow/snowplow/wiki/Collector-logging-formats
const tomcat = [
  "timestamp", // date
  "timestamp", // time
  null, // x-edge-location
  null, // bytes sent
  "ipAddress",
  "method", // method
  "hostname", // remote host
  "path",
  null, // status code
  "refererUri",
  "userAgent",
  "querystring",
  null, // cookies
  null, // x-edge-result-type
  null, // x-edge-request-id
  "contentType",
  "body",
  null, // protocol
  null, // cs-bytes
  null, // time-taken
];

const thriftToRequest = (
  payload?: ITomcatImport,
): Partial<Entry> | undefined => {
  if (
    typeof payload !== "object" ||
    payload === null ||
    (!payload.hasOwnProperty("querystring") && !payload.hasOwnProperty("body"))
  ) {
    return;
  }

  const headers: Header[] = [];
  const cookies: Cookie[] = [
    { name: "sp", value: payload.networkUserId as string },
  ];

  const pheaders = payload.headers as { [header: string]: string };
  for (const p in pheaders) {
    if (payload.headers.hasOwnProperty(p) && pheaders[p] !== "-") {
      headers.push({ name: p, value: pheaders[p] });
    }
  }

  const uri = [
    "https://",
    "badbucket.invalid",
    payload.path || "/",
    payload.querystring ? "?" + payload.querystring : "",
  ].join("");

  // mock out the rest of the Entry interface
  return {
    pageref: "Bad Row",
    request: {
      bodySize: 0,
      cookies,
      headers,
      headersSize: 0,
      httpVersion: "HTTP/1.1",
      method: "body" in payload ? "POST" : "GET",
      postData: {
        mimeType: "application/json",
        text: tryb64(payload.body as string),
      },
      queryString: [],
      url: uri,
    },
    response: {
      bodySize: 0,
      content: {
        mimeType: "text/html",
        size: 0,
        text: "",
      },
      cookies,
      headers: [],
      headersSize: 0,
      httpVersion: "HTTP/1.1",
      redirectURL: "",
      status: 200,
      statusText: "OK",
    },
    startedDateTime: JSON.stringify(new Date(payload.timestamp as string)),
  };
};

const esToRequests = (data: object[], index: string): Entry[] => {
  const base = `https://${index}.elasticsearch/i`;
  return data.map((hit) => {
    if (hit.hasOwnProperty("collector_tstamp")) {
      return goodToRequests(
        hit as { [esKeyName: string]: string },
        base,
      ) as Entry;
    } else {
      return badToRequests([JSON.stringify(hit)])[0];
    }
  });
};

const goodToRequests = (
  data: {
    [esKeyName: string]: string | object;
  },
  baseUri: string,
): Partial<Entry> => {
  const uri = new URL(baseUri);
  const reverseTypeMap: { [event: string]: string } = {
    page_ping: "Page Ping",
    page_view: "Pageview",
    struct: "Structured Event",
    transaction: "Transaction",
    transaction_item: "Transaction Item",
    unstruct: "Self-Describing Event",
  };

  const contexts = [];

  for (const p in data) {
    if (data.hasOwnProperty(p) && data[p] !== null) {
      const key = (protocol.esMap as { [esKeyName: string]: string })[p];
      const val = data[p];
      if (key !== "") {
        if (key === "e") {
          uri.searchParams.set(key, reverseTypeMap[val as string]);
        } else if (/tstamp/.test(p)) {
          const d = new Date(val as string);
          uri.searchParams.set(key, (+d).toString(10));
        } else if (/^unstruct_event_/.test(p)) {
          const { event_vendor, event_name, event_format, event_version } =
            data;

          const wrapped = {
            data: {
              data: val,
              schema: `iglu:${event_vendor}/${event_name}/${event_format}/${event_version}`,
            },
            schema:
              "iglu:com.snowplowanalytics.snowplow/unstruct_event/jsonschema/1-0-0",
          };

          uri.searchParams.set("ue_pr", JSON.stringify(wrapped));
        } else if (/^contexts_/.test(p)) {
          // the 'good' enrichment process irrecoverably destroys vendor/version info, so guess
          const schemaname = p
            .replace("contexts_", "")
            .replace(/_(\d)+$/, "/jsonschema/$1-0-0")
            .replace(/(^.+)_([^_]+_[^_]+)/, "$1/$2")
            .replace(/_/g, ".")
            .replace(/\/([^\./]+).([^\./]+)/, "/$1_$2");

          const ctx = data[p];
          if (Array.isArray(ctx)) {
            for (const c of ctx) {
              contexts.push({
                data: c,
                schema: "iglu:" + schemaname,
              });
            }
          } else throw "protocol violation";
        } else {
          uri.searchParams.set(key, val as string);
        }
      }
    }
  }

  if (contexts.length) {
    const wrapped = {
      data: contexts,
      schema: "iglu:com.snowplowanalytics.snowplow/contexts/jsonschema/1-0-0",
    };

    uri.searchParams.set("co", JSON.stringify(wrapped));
  }

  return {
    pageref: "ElasticSearch (Valid)",
    request: {
      bodySize: 0,
      cookies: [],
      headers: [],
      headersSize: 0,
      httpVersion: "HTTP/1.1",
      method: "GET",
      queryString: [],
      url: uri.href,
    },
    response: {
      bodySize: 0,
      content: {
        mimeType: "text/html",
        size: 0,
        text: "",
      },
      cookies: [],
      headers: [],
      headersSize: 0,
      httpVersion: "HTTP/1.1",
      redirectURL: "",
      status: 200,
      statusText: "OK",
    },
    startedDateTime: new Date().toISOString(),
  };
};

const parseBadRowJson = (
  data: unknown,
  schema: string,
): ITomcatImport | undefined => {
  if (typeof data !== "object" || !data) return;
  if (data.hasOwnProperty("querystring")) return data as ITomcatImport;
  if (!("parameters" in data)) return;

  const result: ITomcatImport = {};

  for (const [key, raw] of Object.entries(data)) {
    const value = typeof raw === "string" ? raw : JSON.stringify(raw);
    switch (key) {
      case "userAgent":
      case "contentType":
        if (value !== null) {
          result[key] = decodeURIComponent(value.replace(/\+/g, " "));
        } else {
          result[key] = value;
        }
        break;

      case "refererUri":
        result[key] = value;
        if (typeof result.headers === "object") {
          result.headers.Referer = value;
        }
        break;

      default:
        result[key] = value;
        break;
    }
  }
  result["schema"] = schema;
  result["path"] = "bad_rows";

  if (typeof result["parameters"] === "string") {
    try {
      result["parameters"] = JSON.parse(result["parameters"]);
    } catch {}
  }

  if (Array.isArray(result["parameters"]) && result["parameters"].length) {
    const qs = new URLSearchParams(
      result["parameters"].map(({ name, value }) => [name, value]),
    );
    result["querystring"] = qs.toString();
  }

  return result;
};

const badToRequests = (data: string[]): Entry[] => {
  const logs = data.map((row) => {
    if (!row.length) {
      return;
    }

    let js = null;

    try {
      js = JSON.parse(row);
    } catch {
      js = row;
    }

    if (typeof js === "object" && js !== null) {
      if (js.hasOwnProperty("line")) {
        // legacy bad row format
        js = js.line;
      } else if (
        // modern bad row format
        js.hasOwnProperty("schema") &&
        js.hasOwnProperty("data") &&
        /^iglu:com\.snowplowanalytics\.snowplow\.badrows\//.test(js.schema)
      ) {
        if (typeof js.data.payload === "string") {
          js = js.data.payload;
        } else {
          return parseBadRowJson(
            js.data.payload?.raw || js.data.payload || js.data,
            js.schema,
          );
        }
      } else console.error("Unknown bad row format", js);
    }

    if (typeof js === "string") {
      // Check for timestamp to identify Tomcat bad row logs
      if (/^[0-9 -]+\t/.test(js)) {
        const result: ITomcatImport = { headers: { Referer: "" } };
        js.split("\t").forEach((x, i) => {
          const field = tomcat[i];
          switch (field) {
            case "timestamp":
              // There are two timestamp fields, check if we've already processed one
              if (
                result.hasOwnProperty(field) &&
                typeof result[field] === "string"
              ) {
                const d = new Date();
                let parts = null;

                // Pretty sure we see date first, but check if they're swapped just in case
                if (x.indexOf(":") > -1) {
                  parts = x.split(":").map((p: string) => parseInt(p, 10));
                  d.setHours(parts[0]);
                  d.setMinutes(parts[1]);
                  d.setSeconds(parts[2]);
                  parts = result[field].split("-").map((p: string) => parseInt(p, 10));
                  d.setFullYear(parts[0]);
                  d.setMonth(parts[1]);
                  d.setDate(parts[2]);
                } else {
                  parts = result[field].split(":").map((p: string) => parseInt(p, 10));
                  d.setHours(parts[0]);
                  d.setMinutes(parts[1]);
                  d.setSeconds(parts[2]);
                  parts = x.split("-").map((p: string) => parseInt(p, 10));
                  d.setFullYear(parts[0]);
                  d.setMonth(parts[1]);
                  d.setDate(parts[2]);
                }

                result[field] = "" + +d;
              } else {
                result[field] = x;
              }
              break;
            case "body":
              if (x !== "-") {
                result.body = tryb64(x);
              }
              break;
            case "querystring":
              const qs = /cv=([^&]+).*nuid=([^&]+)/.exec(x);
              if (qs) {
                result.collector = qs[1];
                result.networkUserId = qs[2];
              }
              result[field] = x;
              break;
            case "userAgent":
            case "contentType":
              result[field] = decodeURIComponent(x.replace(/\+/g, " "));
              break;
            case "refererUri":
              result[field] = x;
              if (typeof result.headers === "object") {
                result.headers.Referer = x;
              }
              break;
            case null:
              break;
            default:
              result[field] = x;
          }
        });

        if (result.method === "OPTIONS") {
          return;
        } else {
          return result;
        }
        // B64 encoded, hopefully thrift from mini/realtime
      } else if (/^([A-Za-z0-9/+]{4})+([A-Za-z0-9/+=]{4})?$/.test(js)) {
        try {
          return decodeB64Thrift(
            js,
            schemas["collector-payload"],
          ) as ITomcatImport;
        } catch (e) {
          console.log(e);
        }
      }
    }
  });

  const entries: Entry[] = [];

  for (const entry of logs.map(thriftToRequest)) {
    if (entry !== undefined) {
      entries.push(entry as Entry);
    }
  }

  return entries;
};

const COLOR_OPTIONS = [
  "turquoise",
  "purple",
  "dark",
  "red",
  "yellow",
  "blue",
  "light",
];
const COLOR_ALLOCATIONS = new Map();

const colorOf = (id: string) => {
  if (!COLOR_ALLOCATIONS.has(id)) {
    COLOR_ALLOCATIONS.set(
      id,
      COLOR_OPTIONS[COLOR_ALLOCATIONS.size % COLOR_OPTIONS.length || 0],
    );
  }

  return COLOR_ALLOCATIONS.get(id);
};

const chunkEach = <T>(
  arr: T[],
  cb: (e: T, i: number) => Promise<void>,
  CHUNK_SIZE: number = 24,
  aborter?: AbortSignal,
) => {
  return new Promise<void>((fulfil) => {
    let next = CHUNK_SIZE;
    let chunk = arr.slice(0, CHUNK_SIZE).map(cb);

    if (!chunk.length) fulfil();

    const step = (chunk: Promise<void>[]): Promise<void> => {
      if (aborter?.aborted) return Promise.resolve();
      return Promise.race(chunk.map((p, i) => p.then(() => i))).then((i) => {
        if (next < arr.length) {
          chunk[i] = cb(arr[next], next);
          next += 1;
        } else {
          chunk = chunk.filter((_, j) => j !== i);
        }

        if (chunk.length && !(aborter?.aborted ?? false)) return step(chunk);
      });
    };

    fulfil(step(chunk));
  });
};

const ngrokEventToHAR = (event: NgrokEvent): Entry => {
  const headers = Object.entries(event.request.headers).map(
    ([name, value]) => ({
      name,
      value,
    }),
  );
  const parsed = tryb64(event.request.raw);
  const body = parsed.split("\n").pop()!;

  return {
    pageref: "Universal Debugger",
    request: {
      bodySize: -1,
      cookies: [],
      headers,
      headersSize: -1,
      httpVersion: event.request.proto,
      method: event.request.method,
      postData: {
        mimeType: "application/json; charset=UTF-8",
        text: body,
      },
      queryString: [],
      url: "https://" + event.request.headers.Host[0] + "/" + event.request.uri, // should we use host or forwarding destination here?
    },
    response: {
      bodySize: 0,
      content: {
        mimeType: "text/html",
        size: 0,
        text: "",
      },
      cookies: [],
      headers: [],
      headersSize: 0,
      httpVersion: "HTTP/1.1",
      redirectURL: "",
      status: event.response.status_code,
      statusText: "OK",
    },
    startedDateTime: event.start,
    time: 0,
    cache: {},
    timings: {
      wait: 0,
      receive: 0,
    },
  };
};

let ngrokWatermark = 0;

const parseNgrokRequests = (data: {
  requests: NgrokEvent[];
}): { entries: Entry[] } => {
  // inspect_db_size (ngrok) defaults to 50MB
  const afterWaterMark = data.requests.filter(
    ({ start }) => +new Date(start) > ngrokWatermark,
  );
  // iterate through and build a HAR request for each event
  const entries = afterWaterMark.map(ngrokEventToHAR);
  // set ngrok watermark
  ngrokWatermark = Math.max(
    ngrokWatermark,
    ...afterWaterMark.map(({ start }) => +new Date(start)),
  );

  return { entries };
};

export {
  badToRequests,
  b64d,
  chunkEach,
  colorOf,
  esToRequests,
  hash,
  hasMembers,
  isSnowplow,
  objHasProperty,
  nameType,
  copyToClipboard,
  thriftToRequest,
  tryb64,
  uuidv4,
  parseNgrokRequests,
  specFromTrackingScenarios,
};

import { Cookie, Entry, Header } from "har-format";
import { protocol } from "./protocol";
import { schemas, decodeB64Thrift } from "./thriftcodec";
import { ITomcatImport } from "./types";

const uuidv4 = (): string =>
  "00000000-0000-4000-8000-000000000000".replace(/0/g, () =>
    Math.floor(Math.random() * 17).toString(16)
  );

const hash = (bytes: string): string => {
  let h = 5381;

  for (let i = 0; i < bytes.length; i++) {
    h = (h << 5) + h + bytes.charCodeAt(i);
  }

  return String(h);
};

function sorted<T>(
  list: Iterable<T>,
  keycb?: (a: T) => any,
  reverse = false
): T[] {
  const sortees: T[] = [];
  const keys: any[] = [];

  for (const e of list) {
    let max = keys.length - 1;
    const key = keycb ? keycb(e) : e;
    sortees.push(e);
    keys.push(key);

    let swap = false;
    while (max >= 0 && reverse ? keys[max] <= key : keys[max] > key) {
      swap = true;
      max--;
    }

    if (swap) {
      sortees.copyWithin(max + 2, max + 1);
      sortees[max + 1] = e;
      keys.copyWithin(max + 2, max + 1);
      keys[max + 1] = key;
    }
  }

  return sortees;
}

const objHasProperty = <T extends {}, K extends PropertyKey>(
  obj: T,
  prop: K
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
    return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
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
    return "array";
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
    cb.style.position = "relative";
    cb.style.left = "-10000px";
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
  payload?: ITomcatImport
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
    pageref: "page_bad",
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

const esToRequests = (data: object[]): Entry[] => {
  return data.map((hit) => {
    if (hit.hasOwnProperty("collector_tstamp")) {
      return goodToRequests(hit as { [esKeyName: string]: string }) as Entry;
    } else {
      return badToRequests([JSON.stringify(hit)])[0];
    }
  });
};

const goodToRequests = (data: {
  [esKeyName: string]: string | object;
}): Partial<Entry> => {
  const uri = new URL("https://elasticsearch.invalid/i");
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
    pageref: "page_good",
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

    if (typeof js === "object" && js !== null && js.hasOwnProperty("line")) {
      js = js.line;
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
                  // @ts-ignore we know this is a string from above
                  parts = result[field].split("-");
                  d.setFullYear(parts[0]);
                  d.setMonth(parts[1]);
                  d.setDate(parts[2]);
                } else {
                  // @ts-ignore we know this is a string from above
                  parts = result[field].split(":");
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
            schemas["collector-payload"]
          ) as ITomcatImport;
        } catch (e) {
          console.log(e);
        }
      }
    }
  });

  const entries = [];

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
      COLOR_OPTIONS[COLOR_ALLOCATIONS.size % COLOR_OPTIONS.length || 0]
    );
  }

  return COLOR_ALLOCATIONS.get(id);
};

const chunkEach = <T>(
  arr: T[],
  cb: (e: T, i: number) => Promise<void>,
  CHUNK_SIZE: number = 24
) => {
  return new Promise<void>((fulfil) => {
    let next = CHUNK_SIZE;
    let chunk = arr.slice(0, CHUNK_SIZE).map(cb);

    if (!chunk.length) fulfil();

    const step = (chunk: Promise<void>[]): Promise<void> => {
      return Promise.race(chunk.map((p, i) => p.then(() => i))).then((i) => {
        if (next < arr.length) {
          chunk[i] = cb(arr[next], next);
          next += 1;
        } else {
          chunk = chunk.filter((_, j) => j !== i);
        }

        if (chunk.length) return step(chunk);
      });
    };

    return step(chunk);
  });
};

export {
  badToRequests,
  b64d,
  chunkEach,
  colorOf,
  esToRequests,
  hash,
  hasMembers,
  objHasProperty,
  nameType,
  copyToClipboard,
  thriftToRequest,
  tryb64,
  uuidv4,
  sorted,
};

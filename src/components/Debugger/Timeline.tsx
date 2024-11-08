import { Cookie, Entry } from "har-format";
import { h, FunctionComponent, VNode } from "preact";
import {
  Dispatch,
  StateUpdater,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "preact/hooks";

import { endpointAnalytics, trackerAnalytics } from "../../ts/analytics";
import { IgluSchema, IgluUri, Resolver } from "../../ts/iglu";
import { protocol } from "../../ts/protocol";
import { BeaconValidity, IBeaconSummary, ITimeline } from "../../ts/types";
import { b64d, colorOf, hash, tryb64 } from "../../ts/util";

import * as importers from "./importers";
import * as exporters from "./exporters";
import { TestSuites } from "./TestSuites";

import "./Timeline.scss";

const GA_REQUIRED_FIELDS = ["tid", "cid", "t", "v", "_gid"];
const KNOWN_FAKE_PAGES = [
  "badbucket.invalid",
  "elasticsearch.invalid",
] as const;

const filterRequest = (beacon: IBeaconSummary, filter?: RegExp) => {
  return (
    typeof filter === "undefined" ||
    (beacon.appId && filter.test(beacon.appId)) ||
    filter.test(beacon.collector) ||
    filter.test(beacon.eventName) ||
    filter.test(beacon.method) ||
    (beacon.page && filter.test(beacon.page)) ||
    (Array.from(beacon.payload.values()) as string[]).filter((x) => {
      let decoded: string | null;
      try {
        decoded = b64d(x);
      } catch (e) {
        decoded = null;
      }

      return filter.test(decoded || "") || filter.test(x);
    }).length > 0
  );
};

const nameEvent = (params: Map<string, string>): string => {
  if (GA_REQUIRED_FIELDS.every((k) => params.has(k))) {
    const event = params.get("t") || "Unknown GA Event";
    const eventDef = protocol.gaMap.t.values;
    return eventDef[event] || event;
  }

  const event = params.get("e") || "Unknown Event";

  const eventDef = protocol.paramMap.e;
  if (eventDef.type !== "emap") return event;

  const eventTypes = eventDef.values;
  switch (event) {
    case "se":
      return eventTypes[event] + ": " + params.get("se_ca");
    case "ue":
      const payload = params.get("ue_pr") || params.get("ue_px") || "";
      let sdeName = "Unstructured";
      let sde = null;

      try {
        sde = JSON.parse(tryb64(payload));
      } catch (e) {
        sde = payload ? JSON.parse(payload) : payload;
      } finally {
        if (
          typeof sde === "object" &&
          sde !== null &&
          sde.hasOwnProperty("schema") &&
          sde.hasOwnProperty("data")
        ) {
          sdeName = sde.data.schema || "Unstructured";
          if (sdeName.startsWith("iglu:")) {
            sdeName = sdeName.split("/")[1];
          }
        }
      }

      return "SD Event: " + sdeName;
    case "pp":
    case "pv":
    case "ti":
    case "tr":
      return eventTypes[event];
    default:
      return event;
  }
};

const validationCache = new Map<string, BeaconValidity>();
const validateEvent = (
  id: string,
  params: Map<string, string>,
  resolver: Resolver,
  updateValidity: Dispatch<StateUpdater<number>>,
) => {
  type SDJ = { schema: IgluUri; data: object | SDJ[] };

  if (validationCache.has(id)) {
    return validationCache.get(id)!;
  }

  const ctxKeys = ["cx", "co"];
  const ueKeys = ["ue_pr", "ue_px"];
  const validatableKeys = ctxKeys.concat(ueKeys);

  const validate = (
    schema: IgluSchema | null,
    data: SDJ["data"],
  ): Promise<BeaconValidity> =>
    schema
      ? resolver
          .resolve(schema)
          .then((res) =>
            Promise.resolve(res.validate(data).valid ? "Valid" : "Invalid"),
          )
      : Promise.resolve("Invalid");

  const validations: Promise<BeaconValidity>[] = [];

  validatableKeys.forEach((key) => {
    const payload = params.get(key);
    if (!payload) return;

    let json: unknown;
    let schema: IgluSchema | null;

    try {
      json = JSON.parse(tryb64(payload));
    } catch (e) {
      console.log(e);
    }

    if (
      typeof json === "object" &&
      json !== null &&
      "schema" in json &&
      "data" in json
    ) {
      const sdj = json as SDJ;
      schema = IgluSchema.fromUri(sdj.schema);
      validations.push(validate(schema, sdj.data).catch(() => "Unrecognised"));

      if (ueKeys.includes(key)) {
        schema = IgluSchema.fromUri((sdj.data as SDJ).schema);
        if (schema)
          validations.push(
            validate(schema, (sdj.data as SDJ).data).catch(
              () => "Unrecognised",
            ),
          );
        // this means data is not an SDJ. This is technically an invalid payload, but could just be old-style unstruct events.
        // the beacon view will show it as invalid, but to reduce UI noise, just pretend it's unrecognised because there is no
        // identifiable schema. This is a legacy behaviour so we'll make an exception here.
        else validations.push(Promise.resolve("Unrecognised"));
      } else if (Array.isArray(sdj.data)) {
        sdj.data.forEach((ctx: SDJ | null) => {
          if (!ctx) {
            validations.push(Promise.resolve("Invalid"));
          } else {
            schema = IgluSchema.fromUri(ctx.schema);
            validations.push(
              validate(schema, ctx.data).catch(() => "Unrecognised"),
            );
          }
        });
      } else {
        console.error("Expected Contexts SDJ to contain Array data");
        validations.push(Promise.resolve("Invalid"));
      }
    } else {
      validations.push(Promise.resolve("Invalid"));
    }
  });

  Promise.all(validations).then((results) => {
    let unrec = false;
    let valid = true;

    for (const result of results) {
      unrec = unrec || result === "Unrecognised";
      valid = valid && result === "Valid";
    }

    if (!unrec) {
      validationCache.set(id, valid ? "Valid" : "Invalid");
      updateValidity((n) => ++n);
    }
  });

  return validationCache.get(id) || "Unrecognised";
};

const summariseBeacons = (
  entry: Entry,
  index: number,
  resolver: Resolver,
  filter: RegExp | undefined,
  updateValidity: Dispatch<StateUpdater<number>>,
): IBeaconSummary[] => {
  const {
    id,
    collector,
    collectorPath,
    method,
    pageref,
    beacons: requests,
    serverAnonymous,
  } = extractRequests(entry, index);

  const results = [];

  for (const [i, req] of requests.entries()) {
    const result: IBeaconSummary = {
      appId: req.get("aid"),
      collector,
      eventName: nameEvent(req),
      pageref,
      id: `#${id}-${i}`,
      method,
      page: req.get("url") || req.get("dl"),
      payload: new Map(req),
      time: new Date(
        parseInt(
          req.get("stm") ||
            req.get("dtm") ||
            (req.get("_gid") ? req.get("_gid") + "000" : "").split(".").pop() ||
            "",
          10,
        ) || +new Date(),
      ).toJSON(),
      validity: validateEvent(`#${id}-${i}`, req, resolver, updateValidity),
      collectorStatus: {
        code: entry.response.status,
        text: (entry.response as any)._error || entry.response.statusText,
      },
      serverAnonymous,
    };

    if (!KNOWN_FAKE_PAGES.includes(result.page as any)) {
      trackerAnalytics(collector, result.page, result.appId);
      endpointAnalytics(
        req.get("tna") || "",
        req.get("aid") || "",
        collector,
        collectorPath,
        method,
        entry.response.status,
      );
    }

    if (filterRequest(result, filter)) {
      results.push(result);
    }
  }

  return results;
};

const getPageUrl = (entries: Entry[]) => {
  const page = entries
    .flatMap((entry) => entry.request.headers)
    .find((header) => /referr?er/i.test(header.name));
  return page && page.value ? new URL(page.value) : null;
};

const extractNetworkUserId = (cookies: Cookie[]): Cookie | undefined => {
  // consider only cookies with the UUID format
  const uuidRegexp =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uuidCookies = cookies.filter((x) => uuidRegexp.test(x.value));
  // prefer a cookie with the name `sp` or take the first one
  return uuidCookies.find((x) => x.name === "sp") ?? uuidCookies.shift();
};

const extractRequests = (
  entry: Entry,
  index: number,
): {
  id: string;
  collector: string;
  collectorPath: string;
  method: string;
  pageref?: string;
  beacons: Map<string, string>[];
  serverAnonymous: boolean;
} => {
  const req = entry.request;
  const pageref =
    entry.pageref && /page_\d+/.test(entry.pageref) ? undefined : entry.pageref;
  const id =
    (pageref || "beacon") +
    hash(new Date(entry.startedDateTime).toJSON() + req.url + index);

  const collectorUrl = new URL(req.url);
  const collector = collectorUrl.hostname;
  const collectorPath = collectorUrl.pathname;
  const method = req.method;
  const beacons = [];

  const nuid = extractNetworkUserId(entry.response.cookies);
  const ua = entry.request.headers.find(
    (x) => x.name.toLowerCase() === "user-agent",
  );
  const lang = entry.request.headers.find(
    (x) => x.name.toLowerCase() === "accept-language",
  );
  const refr = entry.request.headers.find(
    (x) => x.name.toLowerCase() === "referer",
  );
  const cl = entry.request.headers.find(
    (x) => x.name.toLowerCase() === "content-length",
  );
  const ct = entry.request.headers.find(
    (x) => x.name.toLowerCase() === "content-type",
  );

  if (req.method === "POST") {
    if (req.postData === undefined && cl != null && +cl.value > 0) {
      const beacon: Map<string, string> = new Map(
        Object.entries({
          error: [
            "A post request to a known tracker URL was seen, but we could not extract the request body.",
            "This is usually the result of a request sent with the `beacon` eventMethod",
            "as a page is unloaded (e.g. a link click or form submission event that navigates to a new page).",
            "The browser is unable to supply the request body without a reference to the page, so we can't display the events.",
            "Although we can not validate the event, it was probably correctly sent to the collector.",
            "Sorry! :(",
          ].join(" "),
          e: "Unknown Beacon",
          endpoint: req.url,
          payloadSize: cl.value,
          contentType: ct ? ct.value : "",
          stm: "" + +new Date(),
        }),
      );

      if (nuid && nuid.value) beacon.set("nuid", nuid.value);
      if (ua && ua.value) beacon.set("ua", ua.value);
      if (lang && lang.value) beacon.set("lang", lang.value);
      if (refr && refr.value) beacon.set("url", refr.value);

      beacons.push(beacon);
    } else if (req.postData && req.postData.text) {
      try {
        const payload = JSON.parse(req.postData.text);

        for (const pl of payload.data) {
          const beacon: Map<string, string> = new Map(Object.entries(pl));
          if (nuid && !beacon.has("nuid")) {
            beacon.set("nuid", nuid.value);
          }
          if (ua && !beacon.has("ua")) {
            beacon.set("ua", ua.value);
          }
          if (lang && !beacon.has("lang")) {
            beacon.set("lang", lang.value);
          }
          if (refr && !beacon.has("url")) {
            beacon.set("url", refr.value);
          }

          beacons.push(beacon);
        }
      } catch (jsonErr) {
        try {
          const ga = req.postData.text.split("\n").map((line) => {
            const payload: Map<string, string> = new Map();
            new URLSearchParams(line).forEach((val, key) => {
              payload.set(key, val);
            });

            return payload;
          });

          const validGa = ga.filter((b) =>
            GA_REQUIRED_FIELDS.every((k) => b.has(k)),
          );
          beacons.push.apply(beacons, validGa);
        } catch (urlErr) {
          console.log("Invalid request payload", JSON.stringify(req), [
            jsonErr,
            urlErr,
          ]);
        }
      }
    } else {
      console.log("Unexpected empty body in request", req);
    }
  } else {
    const beacon: Map<string, string> = new Map();
    new URL(req.url).searchParams.forEach((value, key) =>
      beacon.set(key, value),
    );
    if (nuid && !beacon.has("nuid")) {
      beacon.set("nuid", nuid.value);
    }
    if (ua && !beacon.has("ua")) {
      beacon.set("ua", ua.value);
    }
    if (lang && !beacon.has("lang")) {
      const langval = /^[^;,]+/.exec(lang.value);
      beacon.set("lang", langval ? langval[0] : lang.value);
    }
    if (refr && !beacon.has("url")) {
      beacon.set("url", refr.value);
    }

    beacons.push(beacon);
  }

  const serverAnonymous = !!req.headers.find(
    (h) => /sp-anonymous/i.test(h.name) && h.value === "*",
  );

  return {
    id,
    collector,
    collectorPath,
    method,
    pageref,
    beacons,
    serverAnonymous,
  };
};

export const Timeline: FunctionComponent<ITimeline> = ({
  displayMode,
  isActive,
  requests,
  resolver,
  setActive,
  setModal,
  addRequests,
  clearRequests,
}) => {
  const [filterStr, setFilterStr] = useState<string>("");

  const filter = useMemo(() => {
    try {
      return filterStr ? new RegExp(filterStr, "i") : undefined;
    } catch (e) {
      return undefined;
    }
  }, [filterStr]);

  const fallbackUrl = useMemo(() => getPageUrl(requests), [requests]);

  const [first, setFirst] = useState<IBeaconSummary>();
  const [hideSuites, setHideSuites] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get({ hideTestSuites: false }, ({ hideTestSuites }) =>
      setHideSuites(hideTestSuites),
    );
  }, []);

  const [validity, updateValidity] = useState(0);

  const events = useMemo(
    () =>
      requests.map((batch, i) =>
        summariseBeacons(batch, i, resolver, filter, updateValidity),
      ),
    [requests, resolver, filter, validity],
  );

  const beacons = events.map((summaries) => {
    setFirst((prev) => prev || summaries[0]);
    return summaries.map((summary): [URL | string | null, VNode] => [
      summary.pageref || (summary.page ? new URL(summary.page) : fallbackUrl),
      <a
        class={[
          "event",
          isActive(summary) ? "event--active" : "",
          // Some race in Firefox where the response information isn't always populated
          summary.collectorStatus.code === 200 ||
          (summary.collectorStatus.code === 0 &&
            summary.collectorStatus.text !== "net::ERR_BLOCKED_BY_CLIENT")
            ? ""
            : "event--uncollected",
          `event--destination-${colorOf(summary.collector + summary.appId)}`,
          summary.validity === "Invalid"
            ? "event--invalid"
            : summary.validity === "Valid"
              ? "event--valid"
              : "event--unrecognised",
        ].join(" ")}
        title={[
          `Time: ${summary.time}`,
          `Collector: ${summary.collector}`,
          `App ID: ${summary.appId}`,
          `Status: ${summary.collectorStatus.code} ${summary.collectorStatus.text}`,
          `Validity: ${summary.validity}`,
        ].join("\n")}
        onClick={setActive.bind(null, { display: "beacon", item: summary })}
      >
        {summary.eventName}
      </a>,
    ]);
  });

  const byPage = beacons.reduce(
    (acc, batch) =>
      batch.reduce((acc, [url, beacon]) => {
        const key =
          url instanceof URL
            ? url.pathname.slice(0, 34)
            : url || "Current Page";
        const tail = acc.pop() || [key, []];
        if (tail[0] === key) {
          tail[1].push(beacon);
          acc.push(tail);
        } else {
          acc.push(tail);
          acc.push([key, [beacon]]);
        }
        return acc;
      }, acc),
    [] as [string, VNode[]][],
  );

  useEffect(() => {
    if (chrome.action)
      chrome.action.setBadgeText({
        tabId: chrome.devtools.inspectedWindow.tabId,
        text: "" + beacons.length,
      });
  }, [beacons.length]);

  if (displayMode === "beacon" && first)
    setActive((active) => active || { display: "beacon", item: first });

  const [streamLock, setStreamLock] = useState(-1);
  const [ngrokStreaming, setNgrokStreaming] = useState(false);

  const importHandler = useCallback(
    (format: importers.ImporterFormat) =>
      importers.importFromFormat(
        format,
        addRequests,
        setModal,
        { ngrokStreaming, setNgrokStreaming },
        { streamLock, setStreamLock },
      ),
    [addRequests, setModal, ngrokStreaming, streamLock],
  );

  useEffect(() => importHandler("ngrok"), [importHandler, ngrokStreaming]);

  const importButtonHandler: h.JSX.GenericEventHandler<HTMLSelectElement> =
    useCallback(
      ({ currentTarget }) => {
        const { value } = currentTarget;

        currentTarget.selectedIndex = 0;
        if (value === "ngrok") {
          setNgrokStreaming((n) => !n);
        } else {
          importHandler(value as importers.ImporterFormat);
        }
      },
      [importHandler],
    );

  const exportButtonHandler: h.JSX.GenericEventHandler<HTMLSelectElement> =
    useCallback(
      ({ currentTarget }) => {
        const { value } = currentTarget;

        currentTarget.selectedIndex = 0;
        exporters.exportToFormat(
          value as exporters.ExporterFormat,
          requests,
          events,
        );
      },
      [requests, events],
    );

  return (
    <aside class="timeline">
      <div class="timeline__controls">
        <div>
          <button
            type="button"
            onClick={clearRequests}
            disabled={!beacons.length}
          >
            Clear Events
          </button>
          <select class="button" onChange={importButtonHandler}>
            <option selected hidden>
              Import
            </option>
            {Object.entries(importers.formats).map(([key, label]) => (
              <option value={key}>
                {key == "ngrok" && ngrokStreaming ? `Stop ${label}` : label}
              </option>
            ))}
          </select>
          <select
            class="button"
            disabled={!beacons.length}
            onChange={exportButtonHandler}
          >
            <option selected hidden>
              Export
            </option>
            {Object.entries(exporters.formats).map(([key, label]) => (
              <option value={key}>{label}</option>
            ))}
          </select>
        </div>
        <input
          class={[filter ? "valid" : filterStr ? "invalid" : "valid"].join(" ")}
          type="text"
          placeholder="Start typing to filter events&hellip;"
          onKeyUp={(e) => {
            if (e.currentTarget instanceof HTMLInputElement) {
              const val = e.currentTarget.value;
              setFilterStr(val);
            }
          }}
          value={filterStr}
        />
      </div>
      <div class="timeline__events">
        {byPage.map(([pageName, beacons]) => (
          <article class="event-group">
            <h1 class="event-group__heading" title="Group Name">
              {pageName}
            </h1>
            {beacons}
          </article>
        ))}
      </div>
      {hideSuites ? null : (
        <TestSuites events={events} setActive={setActive} setModal={setModal} />
      )}
    </aside>
  );
};

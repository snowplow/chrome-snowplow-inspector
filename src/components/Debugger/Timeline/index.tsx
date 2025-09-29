import type { Cookie, Entry } from "har-format";
import { h, type FunctionComponent } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { endpointAnalytics, trackerAnalytics } from "../../../ts/analytics";
import { esMap, protocol } from "../../../ts/protocol";
import type { IBeaconSummary, ITimeline } from "../../../ts/types";
import { b64d, colorOf, hash, tryb64 } from "../../../ts/util";

import { EventEntry } from "./EventEntry";
import { PageGroup } from "./PageGroup";
import { TimelineChrome } from "./TimelineChrome";

import "./Timeline.css";

const GA_REQUIRED_FIELDS = ["tid", "cid", "t", "v", "_gid"] as const;
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
          sde &&
          "schema" in sde &&
          "data" in sde
        ) {
          sdeName = sde.data.schema || "Unstructured";
          if (sdeName.startsWith("iglu:")) {
            sdeName = sdeName.split("/")[1] ?? sdeName;
          }
        }
      }

      return `SD Event: ${sdeName}`;
    case "pp":
    case "pv":
    case "ti":
    case "tr":
      return eventTypes[event];
    default:
      return event;
  }
};

const summariseBatch = ({
  id,
  collector,
  collectorPath,
  method,
  pageref,
  events,
  serverAnonymous,
  status,
  statusText,
}: BatchContents): IBeaconSummary[] => {
  const results: IBeaconSummary[] = [];

  for (const [i, event] of events.entries()) {
    const result: IBeaconSummary = {
      appId: event.get("aid"),
      collector,
      eventName: nameEvent(event),
      pageref,
      id: `#${id}-${i}`,
      method,
      page: event.get("url") || event.get("dl"),
      payload: event,
      time: new Date(
        parseInt(
          event.get("stm") ||
            event.get("dtm") ||
            (event.get("_gid") ? event.get("_gid") + "000" : "")
              .split(".")
              .pop() ||
            "",
          10,
        ) || +new Date(),
      ),
      collectorStatus: {
        code: status,
        text: statusText,
      },
      serverAnonymous,
    };

    if (!KNOWN_FAKE_PAGES.includes(result.page as any)) {
      trackerAnalytics(collector, result.page, result.appId);
      endpointAnalytics(
        event.get("tna") || "",
        event.get("aid") || "",
        collector,
        collectorPath,
        method,
        status,
      );
    }

    results.push(result);
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
  const uuidCookies = cookies.filter(({ value }) => uuidRegexp.test(value));
  // prefer a cookie with the name `sp` or take the first one
  return uuidCookies.find((x) => x.name === "sp") ?? uuidCookies.shift();
};

type BatchContents = {
  id: string;
  collector: string;
  collectorPath: string;
  method: string;
  pageref?: string;
  events: Map<string, string>[];
  serverAnonymous: boolean;
  status: number;
  statusText: string;
};

const extractBatchContents = (
  { request, response, pageref, startedDateTime }: Entry,
  index: number,
): BatchContents => {
  const { headers, method, postData, url } = request;
  const ref = pageref && /^page_\d+/.test(pageref) ? "beacon" : pageref;
  const id = ref + hash(new Date(startedDateTime).toJSON() + url + index);

  const collectorUrl = new URL(url);
  const collector = collectorUrl.hostname;
  const collectorPath = collectorUrl.pathname;
  const events: Map<string, string>[] = [];

  // These fields are set by enrich based on the headers sent to/from the collector
  // Extract these manually so we can display them if they aren't explicitly set
  const nuid = extractNetworkUserId(response.cookies)?.value;
  const ua = headers.find(
    ({ name }) => name.toLowerCase() === "user-agent",
  )?.value;
  const lang = headers.find(
    ({ name }) => name.toLowerCase() === "accept-language",
  )?.value;
  const refr = headers.find(
    ({ name }) => name.toLowerCase() === "referer",
  )?.value;
  const cl = headers.find(
    ({ name }) => name.toLowerCase() === "content-length",
  )?.value;
  const ct = headers.find(
    ({ name }) => name.toLowerCase() === "content-type",
  )?.value;

  const serverAnonymous = headers.some(
    ({ name, value }) => name.toLowerCase() === "sp-anonymous" && value === "*",
  );

  if (method.toUpperCase() === "POST") {
    if (postData == null && cl != null && parseInt(cl, 10) > 0) {
      const event = new Map(
        Object.entries({
          error: [
            "A post request to a known tracker URL was seen, but we could not extract the request body.",
            "This is usually the result of a request sent with the `beacon` eventMethod",
            "as a page is unloaded (e.g. a link click or form submission event that navigates to a new page).",
            "The browser is unable to supply the request body without a reference to the page, so we can't display the events.",
            "Although we can not inspect the event, it was probably correctly sent to the collector.",
          ].join(" "),
          e: "Unknown Event",
          endpoint: url,
          payloadSize: cl,
          contentType: ct ?? "",
          stm: String(+new Date()),
        }),
      );

      events.push(event);
    } else if (postData && postData.text) {
      try {
        const payload: unknown = JSON.parse(postData.text);

        if (!payload || typeof payload !== "object")
          throw Error("Expected Snowplow payload_data SDJ, got non-object");
        if (!("schema" in payload && "data" in payload))
          throw Error("Expected Snowplow payload_data SDJ");
        if (
          typeof payload.schema !== "string" ||
          !/\/payload_data\//.test(payload.schema)
        )
          throw Error("Unexpectedly got non-payload_data SDJ");
        if (!Array.isArray(payload.data))
          throw Error("Invalid payload_data object without array for data");

        for (const pl of payload.data) {
          events.push(new Map(Object.entries(pl)));
        }
      } catch (jsonErr) {
        try {
          const ga = postData.text
            .split("\n")
            .map((line) => new Map(new URLSearchParams(line)));

          const validGa = ga.filter((b) =>
            GA_REQUIRED_FIELDS.every((k) => b.has(k)),
          );
          events.push(...validGa);
        } catch (urlErr) {
          console.error("Invalid request payload", request, [jsonErr, urlErr]);
        }
      }
    } else {
      console.error("Unexpected empty body in request", request);
    }
  } else {
    // GET request, parse the params
    const event = new Map(collectorUrl.searchParams);

    if (lang && !event.has("lang")) {
      const langval = /^[^;,]+/.exec(lang);
      event.set("lang", langval ? langval[0] : lang);
    }

    events.push(event);
  }

  events.forEach((event) => {
    if (nuid && !event.has("nuid")) {
      event.set("nuid", nuid);
    }
    if (ua && !event.has("ua")) {
      event.set("ua", ua);
    }
    if (lang && !event.has("lang")) {
      event.set("lang", lang);
    }
    if (refr && !event.has("url")) {
      event.set("url", refr);
    }
  });

  return {
    id,
    collector,
    collectorPath,
    method,
    pageref: ref,
    events,
    serverAnonymous,
    status: response.status,
    statusText: (response as any)._error || response.statusText,
  };
};

export const Timeline: FunctionComponent<ITimeline> = ({
  active,
  batches,
  destinationManager,
  resolver,
  setActive,
  setApp,
  setAttributeKeys,
  setEventCount,
  setModal,
  addRequests,
  clearRequests,
}) => {
  const [filterStr, setFilterStr] = useState<string>("");

  const batchRef = useRef<Entry[]>([]);
  const summariesRef = useRef<IBeaconSummary[][]>([]);

  const filter = useMemo(() => {
    try {
      return filterStr ? new RegExp(filterStr, "i") : undefined;
    } catch (e) {
      return undefined;
    }
  }, [filterStr]);

  const fallbackUrl = useMemo(() => getPageUrl(batches), [batches]);

  const batchContents = useMemo(
    () => batches.map(extractBatchContents),
    [batches],
  );

  setEventCount(
    batchContents.reduce(
      (sum: number | undefined = 0, batch) => sum + batch.events.length,
      undefined,
    ),
  );

  const batchSummaries = useMemo(
    () =>
      batchContents.map((batch) =>
        summariseBatch(batch).filter((summary) =>
          filterRequest(summary, filter),
        ),
      ),
    [batchContents, filter],
  );

  useEffect(() => {
    setAttributeKeys((targets) => {
      let dirty = false;

      for (const [attributeKey, identifiers] of Object.entries(targets)) {
        const payloadKey =
          attributeKey in esMap
            ? esMap[attributeKey as keyof typeof esMap]
            : undefined;
        if (!payloadKey) continue;

        for (const batch of batchSummaries) {
          for (const { payload } of batch) {
            const id = payload.get(payloadKey);
            if (id != null) {
              dirty = dirty || !identifiers.has(id);
              identifiers.add(id);
            }
          }
        }
      }

      return dirty ? { ...targets } : targets;
    });
  }, [batchSummaries]);

  const pageGroups = useMemo(() => {
    const groups: [string, IBeaconSummary[]][] = [];

    for (const summary of batchSummaries.flat(1)) {
      const { pageref, page } = summary;
      const rawKey = pageref || (page ? new URL(page) : fallbackUrl);
      const key =
        rawKey instanceof URL
          ? rawKey.pathname.slice(0, 34)
          : (rawKey?.slice(0, 34) ?? "Current Page");

      const [lastKey, list] = groups.pop() ?? [key, []];

      if (key === lastKey) {
        list.push(summary);
        groups.push([lastKey, list]);
      } else {
        groups.push([lastKey, list]);
        groups.push([key, [summary]]);
      }
    }

    return groups;
  }, [batchSummaries, fallbackUrl]);

  batchRef.current = batches;
  summariesRef.current = batchSummaries;
  if (pageGroups.length && !active) setActive(pageGroups[0][1][0]);

  return (
    <TimelineChrome
      addRequests={addRequests}
      active={active}
      batchRef={batchRef}
      summariesRef={summariesRef}
      clearRequests={clearRequests}
      destinationManager={destinationManager}
      filter={filter}
      filterStr={filterStr}
      setFilterStr={setFilterStr}
      setApp={setApp}
      setModal={setModal}
    >
      <ol class="timeline__events">
        {pageGroups.map(([pageName, events], i) => (
          <li>
            <PageGroup key={i} pageName={pageName} events={events.length}>
              <ol>
                {events.map((event) => (
                  <li
                    class={`destination-${colorOf(event.collector + event.appId)}`}
                  >
                    <EventEntry
                      key={event.id}
                      event={event}
                      isActive={active?.id == event.id}
                      resolver={resolver}
                      setActive={setActive}
                    />
                  </li>
                ))}
              </ol>
            </PageGroup>
          </li>
        ))}
      </ol>
    </TimelineChrome>
  );
};

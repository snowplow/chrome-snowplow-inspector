import { h, type FunctionComponent } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { endpointAnalytics, trackerAnalytics } from "../../../ts/analytics";
import { GA_REQUIRED_FIELDS } from "../../../ts/extractBatchContents";
import { protocol } from "../../../ts/protocol";
import type {
  BatchContents,
  IBeaconSummary,
  ITimeline,
} from "../../../ts/types";
import { b64d, colorOf, tryb64 } from "../../../ts/util";

import { EventEntry } from "./EventEntry";
import { PageGroup } from "./PageGroup";
import { TimelineChrome } from "./TimelineChrome";

import "./Timeline.css";

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

const getPageUrl = (batches: BatchContents[]) => {
  const page = batches.find(({ sendingPage }) => sendingPage)?.sendingPage;
  return page ? new URL(page) : null;
};

export const Timeline: FunctionComponent<ITimeline> = ({
  active,
  batches,
  destinationManager,
  requestsRef,
  resolver,
  setActive,
  setApp,
  setModal,
  addRequests,
  clearRequests,
}) => {
  const stateKey = "snowplow-event-filters";
  const [filterStr, setFilterStr] = useState<string>(
    sessionStorage.getItem(stateKey) ?? "",
  );

  useEffect(() => sessionStorage.setItem(stateKey, filterStr), [filterStr]);

  const summariesRef = useRef<IBeaconSummary[][]>([]);

  const filter = useMemo(() => {
    try {
      return filterStr ? new RegExp(filterStr, "i") : undefined;
    } catch (e) {
      return undefined;
    }
  }, [filterStr]);

  const fallbackUrl = useMemo(() => getPageUrl(batches), [batches]);

  const batchSummaries = useMemo(
    () =>
      batches.map((batch) =>
        summariseBatch(batch).filter((summary) =>
          filterRequest(summary, filter),
        ),
      ),
    [batches, filter],
  );

  const pageGroups = useMemo(() => {
    const groups: [string, string, IBeaconSummary[]][] = [];

    for (const summary of batchSummaries.flat(1)) {
      const { pageref, page } = summary;
      const pageName =
        (page ? new URL(page) : fallbackUrl)?.pathname ?? "Unknown page";

      const key = pageref || pageName;

      const [latestKey, latestName, latestList] = groups.pop() ?? [];
      const [priorKey, priorName, priorList] = groups.pop() ?? [];
      let newList: (typeof groups)[number] | null = null;

      if (latestKey === key && latestList) {
        latestList.push(summary);
      } else if (priorKey === key && priorList) {
        priorList.push(summary);
      } else {
        newList = [key, pageName, [summary]];
      }

      if (priorKey) groups.push([priorKey, priorName!, priorList!]);
      if (latestKey) groups.push([latestKey, latestName!, latestList!]);
      if (newList) groups.push(newList);
    }

    return groups;
  }, [batchSummaries, fallbackUrl]);

  summariesRef.current = batchSummaries;
  if (pageGroups.length && !active) setActive(pageGroups[0][2][0]);

  return (
    <TimelineChrome
      active={active}
      addRequests={addRequests}
      requestsRef={requestsRef}
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
        {pageGroups.map(([_, pageName, events], i) => (
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

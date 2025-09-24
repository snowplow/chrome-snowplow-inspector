import type { Entry } from "har-format";
import { h, type FunctionComponent } from "preact";
import {
  useCallback,
  useEffect,
  useErrorBoundary,
  useState,
} from "preact/hooks";

import { errorAnalytics } from "../../ts/analytics";
import type { IBeaconSummary, IDebugger, PipelineInfo } from "../../ts/types";
import { isSnowplow } from "../../ts/util";

import { EventPayload } from "./EventPayload";
import { Timeline } from "./Timeline";

import "./Debugger.css";

const isValidBatch = (req: Entry): boolean => {
  if (req.serverIPAddress === "") return false;
  if (req.request.method === "OPTIONS") return false;
  if (req.response.statusText === "Service Worker Fallback Required")
    return false;

  return isSnowplow(req.request);
};

export const Debugger: FunctionComponent<IDebugger> = ({
  destinationManager,
  requests,
  resolver,
  setAttributeKeys,
  setEventCount,
  setModal,
  setRequests,
}) => {
  performance.measure("startDebugger");
  useErrorBoundary(errorAnalytics);
  const [active, setActive] = useState<IBeaconSummary>();
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);

  useEffect(
    () =>
      chrome.storage.local.get({ pipelines: "[]" }, ({ pipelines }) => {
        setPipelines(JSON.parse(pipelines));
      }),
    [],
  );

  const addRequests = useCallback((reqs: Entry[]) => {
    if (!reqs.length) return;

    setRequests((events) => {
      const merged = events.concat(reqs);

      merged.sort((a, b) =>
        a.startedDateTime === b.startedDateTime
          ? 0
          : a.startedDateTime < b.startedDateTime
            ? -1
            : 1,
      );

      return merged;
    });
  }, []);

  const clearRequests = useCallback(() => setRequests([]), []);

  const handleNewRequests = useCallback(
    (...reqs: Entry[]) => {
      const batches: Entry[] = [];

      reqs.forEach((req) => {
        if (isValidBatch(req)) {
          batches.push(req);
          destinationManager.addPath(req.request.url);
        }
      });

      addRequests(batches);
    },
    [addRequests],
  );

  useEffect(() => {
    chrome.devtools.network.getHAR((harLog) => {
      const buildKey = (e: Entry) =>
        "".concat(
          e.startedDateTime,
          e.time as any,
          e.request.url,
          e._request_id as any,
        );
      const existing = new Set<string>(Array.from(requests, buildKey));
      handleNewRequests(
        ...harLog.entries.filter(
          (entry) => isValidBatch(entry) && !existing.has(buildKey(entry)),
        ),
      );
    });

    chrome.devtools.network.onRequestFinished.addListener(handleNewRequests);

    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(
        handleNewRequests,
      );
    };
  }, []);

  return (
    <main class="app app--debugger debugger">
      <Timeline
        active={active}
        setActive={setActive}
        batches={requests}
        resolver={resolver}
        setModal={setModal}
        addRequests={addRequests}
        clearRequests={clearRequests}
        setAttributeKeys={setAttributeKeys}
        setEventCount={setEventCount}
      />
      <div class="debugger__display debugger--beacon">
        {active && (
          <EventPayload
            activeBeacon={active}
            resolver={resolver}
            setModal={setModal}
            pipelines={pipelines}
          />
        )}
      </div>
    </main>
  );
};

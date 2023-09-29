import { Entry } from "har-format";
import { h, FunctionComponent } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import {
  DisplayItem,
  IBeaconSummary,
  IDebugger,
  PipelineInfo,
} from "../../ts/types";
import { isSnowplow } from "../../ts/util";

import { Beacon } from "./Beacon";
import { TestReport } from "./TestReport";
import { Timeline } from "./Timeline";

import "./Debugger.scss";

export const Debugger: FunctionComponent<IDebugger> = ({
  addRequests,
  clearRequests,
  events,
  resolver,
  setModal,
}) => {
  const [active, setActive] = useState<DisplayItem>();
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);

  useEffect(
    () =>
      chrome.storage.local.get({ pipelines: "[]" }, ({ pipelines }) => {
        setPipelines(JSON.parse(pipelines));
      }),
    [],
  );

  const isActive = useCallback(
    (beacon: IBeaconSummary) => {
      if (active && active.display === "beacon")
        return active.item.id === beacon.id;
      return false;
    },
    [active],
  );

  const handleNewRequests = useCallback(
    (reqs: Entry[] | Entry) => {
      const batch = Array.isArray(reqs) ? reqs : [reqs];

      addRequests(
        batch.filter(
          (req) =>
            !(
              req.serverIPAddress === "" ||
              !isSnowplow(req.request) ||
              req.request.method === "OPTIONS" ||
              req.response.statusText === "Service Worker Fallback Required"
            ),
        ),
      );
    },
    [addRequests],
  );

  useEffect(() => {
    chrome.devtools.network.getHAR((harLog) => {
      handleNewRequests(
        harLog.entries.filter(
          (entry) =>
            !events.find(
              (event) =>
                event.startedDateTime === entry.startedDateTime &&
                event.time === entry.time &&
                event.request.url === entry.request.url &&
                event._request_id === entry._request_id,
            ),
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
        setActive={setActive}
        isActive={isActive}
        displayMode={active ? active.display : "beacon"}
        requests={events}
        resolver={resolver}
        setModal={setModal}
        addRequests={addRequests}
        clearRequests={clearRequests}
      />
      {!active || active.display === "beacon" ? (
        <div class="debugger__display debugger--beacon">
          {active && active.item ? (
            <Beacon
              activeBeacon={active.item}
              resolver={resolver}
              setModal={setModal}
              pipelines={pipelines}
            />
          ) : null}
        </div>
      ) : (
        <div class="debugger__display debugger--testcase">
          <TestReport activeSuite={active.item} setActive={setActive} />
        </div>
      )}
    </main>
  );
};

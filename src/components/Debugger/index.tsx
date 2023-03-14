import { Entry, Request } from "har-format";
import { h, FunctionComponent } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import { DisplayItem, IBeaconSummary, IDebugger } from "../../ts/types";
import { isSnowplow } from "../../ts/util";

import { Beacon } from "./Beacon";
import { TestResults } from "./TestResults";
import { Timeline } from "./Timeline";

export const Debugger: FunctionComponent<IDebugger> = ({
  addRequests,
  clearRequests,
  events,
  resolver,
  setModal,
}) => {
  const [active, setActive] = useState<DisplayItem>();

  const isActive = useCallback(
    (beacon: IBeaconSummary) => {
      if (active && active.display === "beacon")
        return active.item.id === beacon.id;
      return false;
    },
    [active]
  );

  const handleNewRequests = useCallback(
    (reqs: Entry[] | Entry) => {
      const batch = Array.isArray(reqs) ? reqs : [reqs];

      addRequests(
        batch.filter(
          (req) =>
            !(
              !isSnowplow(req.request) ||
              req.request.method === "OPTIONS" ||
              req.response.statusText === "Service Worker Fallback Required"
            )
        )
      );
    },
    [addRequests]
  );

  const [compactCore, setCompactCore] = useState(false);
  useEffect(
    () =>
      chrome.storage.sync.get(
        {
          compactCoreMetadata: false,
        },
        ({ compactCoreMetadata }) => {
          setCompactCore(compactCoreMetadata);
        }
      ),
    []
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
                event._request_id === entry._request_id
            )
        )
      );
    });

    chrome.devtools.network.onRequestFinished.addListener(handleNewRequests);

    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(
        handleNewRequests
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
        <div id="beacon" class="column">
          <div class="tile is-ancestor is-vertical inspector">
            <Beacon
              activeBeacon={active && active.item}
              resolver={resolver}
              compact={compactCore}
              setModal={setModal}
            />
          </div>
        </div>
      ) : (
        <div id="testdetail" class="column">
          <div class="tile is-ancestor is-vertical">
            <TestResults activeSuite={active.item} setActive={setActive} />
          </div>
        </div>
      )}
    </main>
  );
};

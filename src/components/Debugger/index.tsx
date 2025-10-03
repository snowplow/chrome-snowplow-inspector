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

import { EventPayload } from "./EventPayload";
import { Timeline } from "./Timeline";

import "./Debugger.css";

export const Debugger: FunctionComponent<IDebugger> = ({
  destinationManager,
  batches,
  listenerStatus,
  requestsRef,
  resolver,
  setApp,
  setModal,
  addRequests,
  setRequests,
}) => {
  performance.measure("startDebugger");
  useErrorBoundary(errorAnalytics);
  const [active, setActive] = useState<IBeaconSummary>();
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(
    () =>
      chrome.storage.local.get(
        { pinned: "[]", pipelines: "[]" },
        ({ pinned, pipelines }) => {
          setPipelines(JSON.parse(pipelines));
          setPinned(JSON.parse(pinned));
        },
      ),
    [],
  );

  useEffect(() => {
    chrome.storage.local.set({ pinned: JSON.stringify(pinned) });
  }, [pinned]);

  const clearRequests = useCallback(() => setRequests([]), []);

  return (
    <main class="app app--debugger debugger">
      <Timeline
        active={active}
        setActive={setActive}
        batches={batches}
        requestsRef={requestsRef}
        resolver={resolver}
        destinationManager={destinationManager}
        setApp={setApp}
        setModal={setModal}
        addRequests={addRequests}
        clearRequests={clearRequests}
      />
      <div class="debugger__display debugger--beacon">
        {active ? (
          <EventPayload
            activeBeacon={active}
            resolver={resolver}
            setModal={setModal}
            pipelines={pipelines}
            pinned={pinned}
            setPinned={setPinned}
          />
        ) : (
          <p class="fallback">
            {listenerStatus === "importing"
              ? "Importing earlier requests from Network panel"
              : "Waiting for new requests..."}
          </p>
        )}
      </div>
    </main>
  );
};

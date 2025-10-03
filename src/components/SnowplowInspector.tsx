import type { Entry } from "har-format";
import { h, type FunctionComponent, Fragment } from "preact";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { extractBatchContents } from "../ts/extractBatchContents";
import { doOAuthFlow } from "../ts/oauth";
import { esMap } from "../ts/protocol";
import type { Application, OAuthResult } from "../ts/types";
import { isSnowplow } from "../ts/util";
import { useSignals } from "../ts/useSignals";
import { Resolver } from "../ts/iglu/Resolver";
import { DestinationManager } from "../ts/DestinationManager";

import {
  modals,
  type Modal,
  type ModalOptions,
  type ModalSetter,
} from "./Modals";
import { Debugger } from "./Debugger";
import { SchemaManager } from "./SchemaManager";
import { Attributes, Interventions } from "./Signals";
import { Toolbar } from "./Toolbar";

import "./SnowplowInspector.css";
import "../styles/tailwind.css";

const isValidBatch = (req: Entry): boolean => {
  if (req.serverIPAddress === "") return false;
  if (req.request.method === "OPTIONS") return false;
  if (req.response.statusText === "Service Worker Fallback Required")
    return false;

  return isSnowplow(req.request);
};

export const SnowplowInspector: FunctionComponent = () => {
  const [application, setApplication] = useState<Application>("debugger");
  const [activeModal, setActiveModal] = useState<Modal>();
  const [login, setLogin] = useState<OAuthResult>();
  const modalOpts = useRef<ModalOptions>();

  const resolver = useMemo(() => new Resolver(), []);
  const destinationManager = useMemo(() => new DestinationManager(), []);

  const [
    signalsInfo,
    signalsDefs,
    attributeKeyIds,
    setAttributeKeyIds,
    interventions,
  ] = useSignals(login, resolver);

  useEffect(() => {
    doOAuthFlow(false)
      .then(setLogin)
      .finally(() => resolver.walk());
  }, [resolver]);

  const setModal: ModalSetter = useCallback(
    (modalName, opts) => {
      if (modalOpts.current && modalOpts.current.callback)
        modalOpts.current.callback();
      if (modalName) {
        modalOpts.current = { kind: modalName, setModal, ...opts };
      } else {
        modalOpts.current = undefined;
      }
      setActiveModal(modalName);
    },
    [modalOpts],
  );

  const [requests, setRequests] = useState<Entry[]>([]);
  const [eventCount, setEventCount] = useState<number>();
  const [interventionCount, setInterventionCount] = useState<number>();

  const requestsRef = useRef<Entry[]>([]);
  requestsRef.current = requests;

  const batches = useMemo(() => requests.map(extractBatchContents), [requests]);

  setInterventionCount(interventions.length || undefined);

  setEventCount(
    batches.reduce(
      (sum: number | undefined = 0, batch) => sum + batch.events.length,
      undefined,
    ),
  );

  setAttributeKeyIds((targets) => {
    let dirty = false;

    for (const [attributeKey, identifiers] of Object.entries(targets)) {
      const payloadKey =
        attributeKey in esMap
          ? esMap[attributeKey as keyof typeof esMap]
          : undefined;
      if (!payloadKey) continue;

      for (const batch of batches) {
        for (const payload of batch.events) {
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

  useEffect(() => {
    chrome.action?.setBadgeText({
      tabId: chrome.devtools.inspectedWindow.tabId,
      text: String(eventCount ?? ""),
    });
  }, [eventCount]);

  const [listenerStatus, setListenerStatus] = useState<
    "waiting" | "importing" | "active"
  >("waiting");

  const addRequests = useCallback((requests: Entry[]) => {
    if (!requests.length) return;

    setListenerStatus("active");

    setRequests((current) => {
      const seen: Set<string> = new Set();
      const merged = current.concat(requests).filter((e) => {
        const key = "".concat(
          e.startedDateTime,
          e.time as any,
          e.request.url,
          e._request_id as any,
        );

        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

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

  useEffect(() => {
    const handleNewRequests = (...reqs: Entry[]) => {
      const batches: Entry[] = [];

      for (const req of reqs) {
        if (isValidBatch(req)) {
          batches.push(req);
          destinationManager.addPath(req.request.url);
        }
      }

      addRequests(batches);
    };

    setListenerStatus("importing");
    chrome.devtools.network.getHAR((harLog) => {
      setListenerStatus("waiting");
      handleNewRequests(...harLog.entries);
    });

    chrome.devtools.network.onRequestFinished.addListener(handleNewRequests);

    return () => {
      chrome.devtools.network.onRequestFinished.removeListener(
        handleNewRequests,
      );
    };
  }, []);

  const Modal = activeModal && modals[activeModal];

  return (
    <>
      <Toolbar
        application={application}
        eventCount={eventCount}
        interventionCount={interventionCount}
        login={login}
        setApp={setApplication}
        setLogin={setLogin}
      />
      {application === "debugger" && (
        <Debugger
          key="app"
          destinationManager={destinationManager}
          batches={batches}
          listenerStatus={listenerStatus}
          requestsRef={requestsRef}
          resolver={resolver}
          setApp={setApplication}
          setModal={setModal}
          addRequests={addRequests}
          setRequests={setRequests}
        />
      )}
      {application === "schemaManager" && (
        <SchemaManager key="app" resolver={resolver} setModal={setModal} />
      )}
      {application === "attributes" && (
        <Attributes
          key="app"
          login={login}
          setLogin={setLogin}
          attributeKeyIds={attributeKeyIds}
          signalsDefs={signalsDefs}
          signalsInfo={signalsInfo}
        />
      )}
      {application === "interventions" && (
        <Interventions
          key="app"
          setInterventionCount={setInterventionCount}
          login={login}
          setLogin={setLogin}
          signalsDefs={signalsDefs}
          signalsInfo={signalsInfo}
          interventions={interventions}
        />
      )}
      {Modal && <Modal key="modal" {...(modalOpts.current as any)} />}
    </>
  );
};

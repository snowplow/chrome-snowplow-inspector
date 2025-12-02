import type { Entry } from "har-format";
import { h, type FunctionComponent, Fragment } from "preact";
import {
  useCallback,
  useEffect,
  useErrorBoundary,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { errorAnalytics } from "../ts/analytics";
import { extractBatchContents } from "../ts/extractBatchContents";
import { doOAuthFlow } from "../ts/oauth";
import { esMap } from "../ts/protocol";
import type { Application, BatchContents, OAuthResult } from "../ts/types";
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
  useErrorBoundary(errorAnalytics);
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
      .then(setLogin, () => {
        // hack for firefox, we can't access identity so this will always fail
        // see if it worked from the popup previously
        if ("getBrowserInfo" in chrome.runtime) {
          const importFirefoxIdentity = ({
            firefoxIdentity,
          }: {
            firefoxIdentity: string;
          }) => {
            const result: null | Omit<OAuthResult, "logout"> =
              JSON.parse(firefoxIdentity);

            if (result)
              setLogin({
                ...result,
                logout() {
                  return new Promise<string>((resolve) => {
                    chrome.storage.local.set(
                      { firefoxIdentity: "null" },
                      () => {
                        setLogin(undefined);
                        resolve("");
                      },
                    );
                  });
                },
              });
          };
          chrome.storage.local.onChanged.addListener((changes) => {
            if (
              "firefoxIdentity" in changes &&
              changes["firefoxIdentity"].newValue
            ) {
              importFirefoxIdentity({
                firefoxIdentity: changes["firefoxIdentity"].newValue,
              });
            }
          });
          chrome.storage.local.get(
            { firefoxIdentity: "null" },
            importFirefoxIdentity,
          );
        }
      })
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
  const [batches, setBatches] = useState<BatchContents[]>([]);
  const [eventCount, setEventCount] = useState<number>();
  const [interventionCount, setInterventionCount] = useState<number>();

  useEffect(() => {
    setRequests((requests) => {
      if (!requests.length) return requests;
      setBatches((batches) => {
        const newest = requests.map(extractBatchContents);
        if (!batches.length) return newest;

        const merged = new Array<BatchContents>(
          batches.length + requests.length,
        );

        let acur = 0,
          bcur = 0,
          mcur = 0;

        while (true) {
          const a = batches[acur];
          const b = newest[bcur];

          if (!a && !b) break;

          if (!b || a?.entry?.startedDateTime < b.entry.startedDateTime) {
            merged[mcur++] = a;
            acur++;
          } else if (
            !a ||
            a.entry.startedDateTime > b?.entry?.startedDateTime
          ) {
            merged[mcur++] = b;
            bcur++;
          } else {
            const keyA = "".concat(
              a.entry.startedDateTime,
              a.entry.time as any,
              a.entry.request.url,
              a.entry._request_id as any,
            );
            const keyB = "".concat(
              b.entry.startedDateTime,
              b.entry.time as any,
              b.entry.request.url,
              b.entry._request_id as any,
            );

            if (keyA === keyB) {
              merged[mcur++] = a;
              merged.length--;
              acur++;
              bcur++;
            } else {
              merged[mcur++] = a;
              acur++;
            }
          }
        }

        return merged;
      });
      return [];
    });
  }, [requests]);

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

    setRequests((current) =>
      current
        .concat(requests)
        .sort((a, b) =>
          a.startedDateTime === b.startedDateTime
            ? 0
            : a.startedDateTime < b.startedDateTime
              ? -1
              : 1,
        ),
    );
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
        key="toolbar"
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
          resolver={resolver}
          setApp={setApplication}
          setBatches={setBatches}
          setModal={setModal}
          addRequests={addRequests}
        />
      )}
      {application === "schemaManager" && (
        <SchemaManager key="app" resolver={resolver} setModal={setModal} />
      )}
      {application === "attributes" && (
        <Attributes
          key="app"
          login={login}
          eventCount={eventCount}
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

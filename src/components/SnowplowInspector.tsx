import type { Entry } from "har-format";
import { h, type FunctionComponent, Fragment } from "preact";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { doOAuthFlow } from "../ts/oauth";
import type { Application, OAuthResult } from "../ts/types";
import { Resolver } from "../ts/iglu/Resolver";
import { DestinationManager } from "../ts/DestinationManager";
import { useSignals } from "../ts/useSignals";

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
  const [attributeCount, setAttributeCount] = useState<number>();
  const [interventionCount, setInterventionCount] = useState<number>();

  useEffect(() => {
    chrome.action?.setBadgeText({
      tabId: chrome.devtools.inspectedWindow.tabId,
      text: String(eventCount ?? ""),
    });
  }, [eventCount]);

  const Modal = activeModal && modals[activeModal];

  return (
    <>
      <Toolbar
        application={application}
        attributeCount={attributeCount}
        eventCount={eventCount}
        interventionCount={interventionCount}
        login={login}
        setApp={setApplication}
        setLogin={setLogin}
      />
      {application === "debugger" && (
        <Debugger
          key="app"
          attributeKeys={attributeKeyIds}
          destinationManager={destinationManager}
          requests={requests}
          resolver={resolver}
          setApp={setApplication}
          setAttributeKeys={setAttributeKeyIds}
          setEventCount={setEventCount}
          setModal={setModal}
          setRequests={setRequests}
        />
      )}
      {application === "schemaManager" && (
        <SchemaManager key="app" resolver={resolver} setModal={setModal} />
      )}
      {application === "attributes" && (
        <Attributes
          key="app"
          setAttributeCount={setAttributeCount}
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

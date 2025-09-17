import { Entry } from "har-format";
import { h, FunctionComponent, Fragment } from "preact";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { consoleAnalytics } from "../ts/analytics";
import { buildRegistry } from "../ts/iglu";
import { apiFetch, doOAuthFlow, CONSOLE_API } from "../ts/oauth";
import { Application, OAuthResult, Organization } from "../ts/types";
import { Resolver } from "../ts/iglu/Resolver";
import { DestinationManager } from "../ts/DestinationManager";

import { modals, Modal, ModalOptions, ModalSetter } from "./Modals";
import { Debugger } from "./Debugger";
import { SchemaManager } from "./SchemaManager";
import { Toolbar } from "./Toolbar";

import "./SnowplowInspector.css";

export const SnowplowInspector: FunctionComponent = () => {
  const [application, setApplication] = useState<Application>("debugger");
  const [activeModal, setActiveModal] = useState<Modal>();
  const [login, setLogin] = useState<OAuthResult>();
  const [signalsInfo, setSignalsInfo] = useState<Record<string, string>>({
    "a6cca997-2453-4e05-bba0-5d0dc2a050a4":
      "ebc6f23c-cec0-4e09-84ee-453e50b556ca.svc.snplow.net",
  });
  const modalOpts = useRef<ModalOptions>();

  const resolver = useMemo(() => new Resolver(), []);
  const destinationManager = useMemo(() => new DestinationManager(), []);

  useEffect(() => {
    doOAuthFlow(false)
      .then(setLogin)
      .finally(() => resolver.walk());
  }, [resolver]);

  useEffect(() => {
    if (!login) return;

    apiFetch("organizations", login.authentication).then(
      (organizations: Organization[]) => {
        consoleAnalytics(
          "Organization Discovery",
          undefined,
          undefined,
          organizations.length,
        );

        const ds = organizations.map((org) =>
          buildRegistry({
            kind: "ds",
            name: `${org.name} (Console)`,
            organizationId: org.id,
            useOAuth: true,
            dsApiEndpoint: CONSOLE_API,
          }),
        );

        Promise.all(
          organizations.map<Promise<[string, string][]>>((org) => {
            if (!org.featuresV2?.signals?.enabled) return Promise.resolve([]);

            return apiFetch("signals/v1", login.authentication, org.id).then(
              (configured: { config: { personalizationApiHost: string } }[]) =>
                configured.map((signals) => [
                  org.id,
                  signals.config.personalizationApiHost,
                ]),
            );
          }),
        ).then((entries) =>
          setSignalsInfo((signals) =>
            Object.assign({}, signals, Object.fromEntries(entries.flat(1))),
          ),
        );

        resolver.import(false, ...ds);
        return resolver.walk();
      },
      () => {
        consoleAnalytics("Organization Discovery Failure");
        // TODO: display error?
      },
    );
  }, [login, resolver, setSignalsInfo]);

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

  const Modal = activeModal && modals[activeModal];

  return (
    <>
      <Toolbar
        application={application}
        eventCount={eventCount}
        login={login}
        setApp={setApplication}
        setLogin={setLogin}
        signalsInfo={signalsInfo}
      />
      {application === "debugger" && (
        <Debugger
          key="app"
          destinationManager={destinationManager}
          requests={requests}
          resolver={resolver}
          setEventCount={setEventCount}
          setModal={setModal}
          setRequests={setRequests}
        />
      )}
      {application === "schemaManager" && (
        <SchemaManager key="app" resolver={resolver} setModal={setModal} />
      )}
      {application === "attributes" && (
        <main key="app" class="app app--attributes attributes">
          <div>This is where attributes should display!</div>
        </main>
      )}
      {application === "interventions" && (
        <main key="app" class="app app--interventions interventions">
          <div>This is where interventions should display!</div>
        </main>
      )}
      {Modal && <Modal key="modal" {...(modalOpts.current as any)} />}
    </>
  );
};

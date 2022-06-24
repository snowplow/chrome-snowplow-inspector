import { Entry } from "har-format";
import { h, FunctionComponent, Fragment } from "preact";
import { useCallback, useMemo, useRef, useState } from "preact/hooks";

import { Application } from "../ts/types";
import { Resolver } from "../ts/iglu/Resolver";

import { modals, Modal, ModalOptions, ModalSetter } from "./Modals";
import { Debugger } from "./Debugger";
import { SchemaManager } from "./SchemaManager";
import { Toolbar } from "./Toolbar";

export const SnowplowInspector: FunctionComponent = () => {
  const [application, setApplication] = useState<Application>("debugger");
  const [activeModal, setActiveModal] = useState<Modal>();
  const modalOpts = useRef<ModalOptions>();

  const resolver = useMemo(() => new Resolver(), []);

  const [events, setEvents] = useState<Entry[]>([]);

  const addRequests = useCallback((reqs: Entry[]) => {
    if (!reqs.length) return;

    setEvents((events) => {
      const merged = [...events, ...reqs];

      merged.sort((a, b) =>
        a.startedDateTime === b.startedDateTime
          ? 0
          : a.startedDateTime < b.startedDateTime
          ? -1
          : 1
      );

      return merged;
    });
  }, []);

  const clearRequests = useCallback(() => setEvents([]), []);

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
    [modalOpts]
  );

  const app = [];

  app.push(
    <Toolbar
      addRequests={addRequests}
      changeApp={setApplication}
      application={application}
      clearRequests={clearRequests}
      setModal={setModal}
    />
  );

  switch (application) {
    case "debugger":
      app.push(
        <Debugger
          addRequests={addRequests}
          events={events}
          resolver={resolver}
          setModal={setModal}
        />
      );
      break;
    case "schemaManager":
      app.push(<SchemaManager resolver={resolver} setModal={setModal} />);
      break;
  }

  if (activeModal) {
    const Modal = modals[activeModal];
    app.push(<Modal {...(modalOpts.current as any)} />);
  }

  return <>{app}</>;
};

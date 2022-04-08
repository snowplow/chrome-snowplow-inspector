import { Entry } from "har-format";
import {
  redraw,
  default as m,
  ClosureComponent,
  Component,
  Vnode,
} from "mithril";

import { Application } from "../ts/types";
import { Resolver } from "../ts/iglu/Resolver";

import { modals, Modal, ModalOptions, ModalSetter } from "./Modals";
import { Debugger } from "./Debugger";
import { SchemaManager } from "./SchemaManager";
import { Toolbar } from "./Toolbar";

export const SnowplowInspector: ClosureComponent = () => {
  let application: Application = "debugger";
  let activeModal: Modal | undefined = undefined;
  let modalOpts: ModalOptions | undefined = undefined;
  const resolver = new Resolver();

  const events: Entry[] = [];

  function addRequests(reqs: Entry[]) {
    if (!reqs.length) return;

    events.push.apply(events, reqs);
    events.sort((a, b) =>
      a.startedDateTime === b.startedDateTime
        ? 0
        : a.startedDateTime < b.startedDateTime
        ? -1
        : 1
    );
    redraw();
  }

  function changeApp(app: Application) {
    application = app;
  }
  const setModal: ModalSetter = (modalName, opts) => {
    activeModal = modalName;
    if (modalOpts && modalOpts.callback) modalOpts.callback();
    if (modalName) {
      modalOpts = { kind: modalName, setModal, ...opts };
    } else {
      modalOpts = undefined;
    }
    redraw();
  };

  return {
    view: () => {
      let app: Vnode<any>, modal: Vnode<any> | undefined;
      switch (application) {
        case "debugger":
          app = m(Debugger, { addRequests, events, resolver, setModal });
          break;
        case "schemaManager":
          app = m(SchemaManager, { resolver, setModal });
          break;
      }

      if (activeModal) {
        modal = m(modals[activeModal] as Component<any>, { ...modalOpts });
      }

      return [
        m(Toolbar, {
          addRequests,
          changeApp,
          application,
          clearRequests: () => (events.length = 0),
          setModal,
        }),
        app,
        modal,
      ];
    },
  };
};

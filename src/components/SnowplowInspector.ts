import { Entry } from "har-format";
import { redraw, default as m, Vnode } from "mithril";

import { Application } from "../ts/types";
import { Resolver } from "../ts/iglu/Resolver";

import { modals, Modal, ModalOptions } from "./Modals";
import { Debugger } from "./Debugger";
import { SchemaManager } from "./SchemaManager";
import { Toolbar } from "./Toolbar";

export const SnowplowInspector = () => {
  let application: Application = "debugger";
  let activeModal: Modal | undefined = undefined;
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
  function setModal(modalName?: Modal, modalOpts?: ModalOptions) {
    activeModal = modalName;
  }

  return {
    view: () => {
      let app: Vnode<any>, modal: Vnode<any> | undefined;
      switch (application) {
        case "debugger":
          app = m(Debugger, { addRequests, events, resolver });
          break;
        case "schemaManager":
          app = m(SchemaManager, { resolver });
          break;
      }

      if (activeModal) {
        modal = m(modals[activeModal], {
          kind: activeModal,
          addRequests,
          setModal,
        });
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

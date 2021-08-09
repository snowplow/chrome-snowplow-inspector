import { Entry } from "har-format";
import { redraw, default as m } from "mithril";

import { Application, Modal } from "../ts/types";
import { Resolver } from "../ts/iglu/Resolver";

import { BadRowsModal, LiveStreamModal } from "./Modals";
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
  function changeModal(modalName?: Modal) {
    activeModal = modalName;
  }

  return {
    view: () => {
      let app, modal;
      switch (application) {
        case "debugger":
          app = m(Debugger, { addRequests, events, resolver });
          break;
        case "schemaManager":
          app = m(SchemaManager, { resolver });
          break;
      }

      switch (activeModal) {
        case "badRows":
          modal = m(BadRowsModal, {
            addRequests,
            setModal: changeModal,
          });
          break;
        case "stream":
          modal = m(LiveStreamModal, {
            addRequests,
            setModal: changeModal,
          });
          break;
        default:
          modal = undefined;
      }

      return [
        m(Toolbar, {
          addRequests,
          changeApp,
          application,
          clearRequests: () => (events.length = 0),
          setModal: changeModal,
        }),
        app,
        modal,
      ];
    },
  };
};

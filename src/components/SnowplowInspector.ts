import { Entry } from "har-format";
import { redraw, default as m } from "mithril";

import { Application } from "../ts/types";
import { Resolver } from "../ts/iglu/Resolver";

import { BadRowsModal, LiveStreamModal } from "./Modals";
import { Debugger } from "./Debugger";
import { SchemaManager } from "./SchemaManager";
import { Toolbar } from "./Toolbar";

export const SnowplowInspector = () => {
  let modal: string | undefined;
  let application: Application = "debugger";
  const resolver = new Resolver();

  const events: Entry[] = [];

  function setModal(modalName?: string) {
    modal = modalName;
  }

  function addRequests(reqs: Entry[]) {
    events.push.apply(events, reqs);
    redraw();
  }

  function changeApp(app: Application) {
    application = app;
  }

  return {
    view: () => {
      let app;
      switch (application) {
        case "debugger":
          app = m(Debugger, { addRequests, events, resolver });
          break;
        case "schemaManager":
          app = m(SchemaManager, { resolver });
          break;
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
        m(BadRowsModal, {
          addRequests,
          modal,
          setModal,
        }),
        m(LiveStreamModal, {
          addRequests,
          modal,
          setModal,
        }),
      ];
    },
  };
};

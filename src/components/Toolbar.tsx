import { h, FunctionComponent } from "preact";

import { Application, IToolbar } from "../ts/types";
import { ConsoleStatus } from "./ConsoleStatus";

import "./Toolbar.scss";

export const Toolbar: FunctionComponent<IToolbar> = ({
  application,
  eventCount,
  login,
  setApp,
  setLogin,
  signalsInfo,
}) => {
  const status =
    typeof eventCount == "number"
      ? eventCount > 0
        ? "active"
        : "inactive"
      : "";

  const enableSignals = Object.values(signalsInfo).some(Boolean);
  return (
    <header class="toolbar">
      <nav
        class="toolbar__tabs"
        onChange={(e) => {
          if (e.target instanceof HTMLInputElement) {
            e.stopPropagation();
            setApp(e.target.value as Application);
          }
        }}
      >
        <label>
          <input
            type="radio"
            name="application"
            value="debugger"
            checked={application === "debugger"}
          />
          <span class={status}>
            <img alt="" src="list-tree.svg" />
          </span>
          <span>Events</span>
          {eventCount ? <span>{eventCount}</span> : null}
        </label>
        <label>
          <input
            type="radio"
            name="application"
            value="schemaManager"
            checked={application === "schemaManager"}
          />
          Data Structures
        </label>
        {enableSignals && (
          <label>
            <input
              type="radio"
              name="application"
              value="attributes"
              checked={application === "attributes"}
            />
            Attributes
          </label>
        )}
        {enableSignals && (
          <label>
            <input
              type="radio"
              name="application"
              value="interventions"
              checked={application === "interventions"}
            />
            Interventions
          </label>
        )}
      </nav>
      <ConsoleStatus login={login} setLogin={setLogin} />
    </header>
  );
};

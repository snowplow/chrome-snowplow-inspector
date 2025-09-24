import { h, type FunctionComponent } from "preact";
import { Box, DatabaseZap, GitBranchPlus, ListTree } from "lucide-preact";

import type { Application, IToolbar } from "../ts/types";
import { ConsoleStatus } from "./ConsoleStatus";

import "./Toolbar.css";

export const Toolbar: FunctionComponent<IToolbar> = ({
  application,
  attributeCount,
  eventCount,
  interventionCount,
  login,
  setApp,
  setLogin,
}) => {
  const eventStatus =
    typeof eventCount == "number"
      ? eventCount > 0
        ? "active"
        : "inactive"
      : "";
  const attributeStatus =
    typeof attributeCount == "number"
      ? attributeCount > 0
        ? "active"
        : "inactive"
      : "";
  const interventionStatus =
    typeof interventionCount == "number"
      ? interventionCount > 0
        ? "active"
        : "inactive"
      : "";

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
          <span class={eventStatus}>
            <ListTree />
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
          <span>
            <Box />
          </span>
          <span>Data Structures</span>
        </label>
        <label>
          <input
            type="radio"
            name="application"
            value="attributes"
            checked={application === "attributes"}
          />
          <span class={attributeStatus}>
            <DatabaseZap />
          </span>
          <span>Attributes</span>
          {attributeCount ? <span>{attributeCount}</span> : null}
        </label>
        <label>
          <input
            type="radio"
            name="application"
            value="interventions"
            checked={application === "interventions"}
          />
          <span class={interventionStatus}>
            <GitBranchPlus />
          </span>
          <span>Interventions</span>
          {interventionCount ? <span>{interventionCount}</span> : null}
        </label>
      </nav>
      <ConsoleStatus login={login} setLogin={setLogin} />
    </header>
  );
};

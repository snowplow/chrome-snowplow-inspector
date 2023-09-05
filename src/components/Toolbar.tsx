import { h, FunctionComponent, Fragment } from "preact";
import { useCallback } from "preact/hooks";

import { landingUrl } from "../ts/analytics";
import { IToolbar } from "../ts/types";
import { ConsoleStatus } from "./ConsoleStatus";

import "./Toolbar.scss";

const ToolbarView: FunctionComponent<IToolbar> = ({
  application,
  changeApp,
  setModal,
}) => {
  const changeToSchemaManager = useCallback(
    () => changeApp("schemaManager"),
    [changeApp],
  );
  const changeToDebugger = useCallback(
    () => changeApp("debugger"),
    [changeApp],
  );

  switch (application) {
    case "debugger":
      return (
        <>
          <button
            class="button is-outlined is-small control"
            onClick={changeToSchemaManager}
          >
            Manage Schemas
          </button>
        </>
      );
    case "schemaManager":
      return (
        <>
          <button
            class="button is-outlined is-small control"
            onClick={changeToDebugger}
          >
            Back to Debugger
          </button>
        </>
      );
  }
};

export const Toolbar: FunctionComponent<IToolbar> = (props) => (
  <header class="toolbar">
    <a class="toolbar__logo" href={landingUrl} target="_blank">
      <img alt="Snowplow logo" src="logo.svg" />
    </a>
    <nav class="toolbar__buttons">
      <ToolbarView {...props} />
    </nav>
    <ConsoleStatus setModal={props.setModal} resolver={props.resolver} />
  </header>
);

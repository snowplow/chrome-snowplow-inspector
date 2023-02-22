import { h, FunctionComponent, Fragment } from "preact";
import { useCallback } from "preact/hooks";

import { landingUrl } from "../ts/analytics";
import { IToolbar } from "../ts/types";

const ToolbarView: FunctionComponent<IToolbar> = ({
  application,
  changeApp,
}) => {
  const changeToSchemaManager = useCallback(
    () => changeApp("schemaManager"),
    [changeApp]
  );
  const changeToDebugger = useCallback(
    () => changeApp("debugger"),
    [changeApp]
  );

  switch (application) {
    case "debugger":
      return (
        <>
          <a
            class="button is-outlined is-small control"
            onClick={changeToSchemaManager}
          >
            Manage Schemas
          </a>
        </>
      );
    case "schemaManager":
      return (
        <>
          <a
            class="button is-outlined is-small control"
            onClick={changeToDebugger}
          >
            Back to Debugger
          </a>
        </>
      );
  }
};

export const Toolbar: FunctionComponent<IToolbar> = (props) => (
  <nav class="navbar is-flex-touch">
    <div class="navbar-brand">
      <a class="navbar-item" href={landingUrl} target="_blank">
        <img alt="Poplin Data logo" src="pd-logo.png" />
      </a>
    </div>
    <div class="navbar-menu is-active is-shadowless">
      <div class="navbar-start">
        <div class="navbar-item field is-grouped">
          <ToolbarView {...props} />
        </div>
      </div>
    </div>
  </nav>
);

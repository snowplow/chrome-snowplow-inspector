import { h, FunctionComponent } from "preact";
import { useState } from "preact/hooks";

import { IConsoleStatus, OAuthIdentity } from "../ts/types";

import "./ConsoleStatus.scss";

export const ConsoleStatus: FunctionComponent<IConsoleStatus> = ({
  resolver,
  setModal,
}) => {
  const [identity, setIdentity] = useState<OAuthIdentity>();

  const handler = () => {
    setModal("consoleSync", {
      resolver,
      setIdentity,
    });
  };

  return !chrome.identity ? null : identity ? (
    <button
      class="console"
      disabled
      title={`Console: ${identity.iss}\nLogin: ${identity.sub}\nLast Update: ${
        identity.updated_at
      }\n\n${JSON.stringify(identity)}`}
    >
      <img src={identity.picture} />
      {identity.name || "Logged In"}
    </button>
  ) : (
    <button class="console" onClick={handler}>
      Sync with Console
    </button>
  );
};

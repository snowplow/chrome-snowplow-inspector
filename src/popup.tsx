import { render, h } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import { homepage } from "../package.json";
import { doOAuthFlow } from "./ts/oauth";
import type { OAuthIdentity } from "./ts/types";

import "./popup.scss";

const Shortcut = () => {
  const [os, setOs] = useState<chrome.runtime.PlatformInfo["os"]>("win");

  useEffect(() => {
    chrome.runtime.getPlatformInfo((info) => setOs(info.os));
  }, []);

  return os === "mac" ? (
    <kbd>
      <kbd>⌘ Cmd</kbd>+<kbd>⌥ Alt</kbd>+<kbd>I</kbd>
    </kbd>
  ) : (
    <kbd>
      <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>
    </kbd>
  );
};

const ConsoleDetails = () => {
  const [identity, setIdentity] = useState<OAuthIdentity>();
  const [authenticating, setAuthenticating] = useState<boolean>(false);

  useEffect(() => {
    doOAuthFlow(false).then(({ identity }) => setIdentity(identity));
  }, []);

  const startFlow = useCallback(() => {
    setAuthenticating(true);
    doOAuthFlow(true).then(({ identity }) => {
      setIdentity(identity);
      setAuthenticating(false);
    });
  }, []);

  return (
    <div class="console">
      <h2>Synchronize with Console</h2>
      <p class="muted">
        Synchronizing Snowplow Inspector with your Snowplow Console login
        enables the following functionality:
      </p>
      <ul class="muted">
        <li>
          Collect and display pipeline configuration such as enabled Enrichments
          for events sent to a pipeline
        </li>
        <li>
          Import registry information for production and development (Mini)
        </li>
      </ul>
      {identity ? (
        <p>Console account: {identity.name || "Logged In"}</p>
      ) : (
        <button
          type="button"
          class="cta"
          onClick={startFlow}
          disabled={authenticating}
        >
          Sign in to Snowplow Console
        </button>
      )}
    </div>
  );
};

const Popup = () => (
  <div class="wrapper">
    <h1>
      <img src="logo.svg" alt="Snowplow logo" />
      Snowplow Inspector
    </h1>
    <div>
      <p>
        The inspector is a debugger for{" "}
        <a href="https://snowplow.io/?utm_source=debugger%20extension&utm_medium=software&utm_campaign=Chrome%20extension%20about%20page">
          Snowplow Behavioral Data Platform
        </a>
        .
      </p>
      <h2>How it works</h2>
      <p class="muted">
        Open Dev Tools (<Shortcut />) and switch to the &ldquo;Snowplow&rdquo;
        debugger tab.
        <img src="devbar.png" alt="Screenshot showing Snowplow tab" />
      </p>
      <h2>What's new?</h2>
      <p>
        <a
          class="button"
          href={`${homepage}/releases/tag/v${
            chrome.runtime.getManifest().version
          }`}
          target="_blank"
        >
          View Release Notes
        </a>
      </p>
      <h2>Bugs &amp; Feature Requests</h2>
      <p>
        <a class="button" href={`${homepage}/issues`} target="_blank">
          Let us know how to improve
        </a>
      </p>
    </div>
    <ConsoleDetails />
  </div>
);

render(<Popup />, document.body);

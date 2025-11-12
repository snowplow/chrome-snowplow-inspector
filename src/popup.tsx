import { render, h } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import { homepage } from "../package.json";
import { utmify } from "./ts/analytics";
import { doOAuthFlow } from "./ts/oauth";
import type { OAuthIdentity } from "./ts/types";

import "./popup.css";
import logo from "../res/logo.svg";

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
  // hack for firefox, we can't request permissions in dev-panel pending: https://bugzilla.mozilla.org/show_bug.cgi?id=1796933
  const [requestedPermissions, setRequestedPermissions] = useState<string[]>(
    [],
  );

  useEffect(() => {
    doOAuthFlow(false).then(
      ({ identity }) => setIdentity(identity),
      () => {
        // hack for firefox, we can't request identity in dev-panel pending: https://bugzilla.mozilla.org/show_bug.cgi?id=1796933
        if ("getBrowserInfo" in chrome.runtime) {
          chrome.storage.local.set({ firefoxIdentity: "null" });
        }
      },
    );

    // hack for firefox, we can't request permissions in dev-panel pending: https://bugzilla.mozilla.org/show_bug.cgi?id=1796933
    if ("getBrowserInfo" in chrome.runtime)
      chrome.storage.local.get(
        { firefoxPermissions: "[]", firefoxPermissionsGranted: "[]" },
        ({ firefoxPermissions, firefoxPermissionsGranted }) => {
          const defaultHostPerms: string[] =
            chrome.runtime.getManifest().host_permissions ?? [];
          const pendingPermissions: string[] = JSON.parse(firefoxPermissions);
          const grantedPermissions: string[] = JSON.parse(
            firefoxPermissionsGranted,
          );

          const origins = Array.from(
            new Set(
              defaultHostPerms
                .map((o) => o.replace("/*", "/"))
                .concat(pendingPermissions),
            ),
          ).filter((origin) => !grantedPermissions.includes(origin));

          chrome.permissions.contains({ origins }, (result) => {
            if (result) {
              chrome.storage.local.set({
                firefoxPermissions: "[]",
                firefoxPermissionsGranted: JSON.stringify(
                  grantedPermissions.concat(origins),
                ),
              });
            } else if (origins.length) {
              setRequestedPermissions(origins);
            }
          });
        },
      );
  }, []);

  const startFlow = useCallback(() => {
    setAuthenticating(true);
    doOAuthFlow(true).then(({ access, authentication, identity }) => {
      setIdentity(identity);
      setAuthenticating(false);
      // hack for firefox, we can't request identity in dev-panel pending: https://bugzilla.mozilla.org/show_bug.cgi?id=1796933
      if ("getBrowserInfo" in chrome.runtime)
        chrome.storage.local.set({
          firefoxIdentity: JSON.stringify({ access, authentication, identity }),
        });
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
      {requestedPermissions.length > 0 && (
        <button
          type="button"
          class="cta"
          onClick={() =>
            chrome.permissions.request(
              { origins: requestedPermissions },
              (granted) =>
                setRequestedPermissions((orig) => (granted ? [] : orig)),
            )
          }
        >
          Grant required permissions
        </button>
      )}
    </div>
  );
};

const Popup = () => (
  <div class="wrapper">
    <h1>
      <img src={logo} alt="Snowplow logo" />
      Snowplow Inspector
    </h1>
    <div>
      <p>
        The inspector is a debugger for{" "}
        <a
          href={utmify("https://snowplow.io/", {
            utm_campaign: "Chrome extension about page",
          })}
        >
          Snowplow Customer Data Infrastructure
        </a>
        .
      </p>
      <h2>How it works</h2>
      <p class="muted">
        Open Dev Tools (<Shortcut />) and switch to the &ldquo;Snowplow&rdquo;
        debugger tab.
        <img src="assets/devbar.png" alt="Screenshot showing Snowplow tab" />
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

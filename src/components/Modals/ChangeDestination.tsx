import { h, type FunctionComponent } from "preact";
import { useEffect, useState } from "preact/hooks";
import { BaseModal } from "./BaseModal";

import type { ModalOptions } from ".";
import { DestinationManager } from "../../ts/DestinationManager";
import { request } from "../../ts/permissions";

export interface ChangeDestinationOptions extends ModalOptions {
  destinationManager: DestinationManager;
}

export const ChangeDestination: FunctionComponent<ChangeDestinationOptions> = ({
  destinationManager,
  setModal,
}) => {
  const state = destinationManager.status();
  const [destinations, setDestinations] = useState(
    state.destinations.join("\n"),
  );
  const [endpoint, setEndpoint] = useState(
    state.endpoint ? state.endpoint.href : "",
  );
  const [enabled, setEnabled] = useState(state.enabled);
  const [requestingPerms, setRequestingPerms] = useState(false);

  useEffect(
    () =>
      void (
        requestingPerms &&
        // For this to work we need permissions for all three of: destination hosts, endpoint host, and initiator domain host
        chrome.devtools.inspectedWindow.eval(
          "window.location.hostname", // port is not allowed and the domain permission gives access to that anyway
          (hostname) => {
            const destinationList = destinations.split("\n").filter(Boolean); // 1: destination hosts
            if (enabled) {
              const endpointUrl = new URL(endpoint);
              const additionalPerms = [`*://${endpointUrl.hostname}/*`]; // 2: endpoint host

              if (hostname) additionalPerms.push(`*://${hostname}/*`); // 3: initiator host

              request(
                ...additionalPerms,
                ...destinationList.map((e) =>
                  e.includes("://")
                    ? `${e.replace(/^.+:\/\//, "*://")}/*`
                    : `*://${e}/*`,
                ),
              ).then(() => {
                destinationManager.update(destinationList, endpoint, enabled);
                setModal();
              });
            } else {
              destinationManager.update(destinationList, endpoint, enabled);
              setModal();
            }
          },
        )
      ),
    [requestingPerms],
  );

  return (
    <BaseModal
      title="Change Destination"
      onClose={setModal}
      onSubmit={(e) => {
        e.preventDefault();

        if (!e.currentTarget.reportValidity()) return;
        setRequestingPerms(true);
      }}
    >
      <section>
        <p>
          Use these settings to force events sent to certain destination
          pipelines to go to another pipeline. This is useful for sending events
          to test pipelines like{" "}
          <a href="https://docs.snowplow.io/docs/testing-debugging/snowplow-micro/what-is-micro/">
            Snowplow Micro
          </a>
          , or to prevent internal traffic polluting production pipelines. Enter
          collector domains, one per line.
        </p>
        <p>
          Forwarding will only occur for the tab you are currently inspecting,
          and will continue until you disable Destination Changing (even after
          closing the extension).
        </p>
        <p>
          The extension requires permissions to modify the requests for each
          site you want to use this feature on. If forwarding doesn't work, save
          these settings while inspecting the new site for the extension to
          trigger a permissions prompt.
        </p>
        <p>
          Requests using custom POST paths will preserve their custom path
          unless your Target Endpoint specifies an explicit path to prefer, e.g.{" "}
          <code>/com.snowplowanalytics.snowplow/tp2</code> for the default POST
          endpoint.
        </p>
        <div>
          <label>
            Collectors to forward
            <textarea
              id="destinations"
              name="destinations"
              class="textarea"
              required={enabled}
              rows={6}
              value={destinations}
              onInput={({ currentTarget }) => {
                setDestinations(currentTarget.value);
              }}
            />
          </label>
        </div>
        <div>
          <label>
            Destination
            <input
              id="endpoint"
              name="endpoint"
              type="url"
              placeholder="http://localhost:9090/"
              required={enabled}
              value={endpoint}
              onInput={({ currentTarget }) => setEndpoint(currentTarget.value)}
            />
          </label>
        </div>
        <div>
          <label>
            <input
              id="enabled"
              name="enabled"
              type="checkbox"
              checked={enabled}
              onInput={({ currentTarget }) => setEnabled(currentTarget.checked)}
            />
            Enable Forwarding
          </label>
        </div>
        {requestingPerms ? (
          <p>Permissions required, click again to prompt.</p>
        ) : null}
      </section>
      <footer>
        <button>Apply</button>
      </footer>
    </BaseModal>
  );
};

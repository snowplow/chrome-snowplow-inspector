import { Har } from "har-format";
import { h, FunctionComponent, Fragment } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";

import { landingUrl } from "../ts/analytics";
import { IToolbar } from "../ts/types";
import { isSnowplow, parseNgrokRequests } from "../ts/util";
import { immediatelyRequest } from "../ts/permissions";

const ngrokStreamInterval: number = 1500;

const ToolbarView: FunctionComponent<IToolbar> = ({
  addRequests,
  application,
  changeApp,
  clearRequests,
  setModal,
}) => {
  const changeToSchemaManager = useCallback(
    () => changeApp("schemaManager"),
    [changeApp]
  );
  const changeToDebugger = useCallback(
    () => changeApp("debugger"),
    [changeApp]
  );
  const badRowsModal = useCallback(
    () => setModal("badRows", { addRequests }),
    [setModal, addRequests]
  );

  const [streamLock, setStreamLock] = useState(-1);

  const streamModal = useCallback(
    () => setModal("stream", { addRequests, streamLock, setStreamLock }),
    [setModal, addRequests, streamLock]
  );

  const importHar = useCallback(() => {
    const f: HTMLInputElement = document.createElement("input");
    f.type = "file";
    f.multiple = true;
    f.accept = ".har";

    f.onchange = (change: Event) => {
      if (change.target instanceof HTMLInputElement) {
        const files = change.target.files || new FileList();

        for (let i = 0; i < files.length; i++) {
          const file = files.item(i);

          if (file !== null) {
            const fr = new FileReader();

            fr.addEventListener(
              "load",
              () => {
                const content = JSON.parse(fr.result as string) as Har;
                addRequests(
                  content.log.entries.filter((entry) =>
                    isSnowplow(entry.request)
                  )
                );
              },
              false
            );

            fr.readAsText(file);
          }
        }
      }
    };

    f.click();
  }, [addRequests]);

  const [ngrokStreaming, setNgrokStreaming] = useState(false);
  const [ngrokTunnel, setNgrokTunnel] = useState("http://localhost:4040/");

  const ngrokHandler = useCallback(() => {
    chrome.storage.sync.get(
      { tunnelAddress: ngrokTunnel },
      ({ tunnelAddress }) =>
        chrome.permissions.contains({ origins: [tunnelAddress] }, (granted) =>
          (granted
            ? Promise.resolve()
            : immediatelyRequest([tunnelAddress])
          ).then(() => {
            setNgrokTunnel(tunnelAddress);
            setNgrokStreaming((ngrokStreaming) => !ngrokStreaming);
          })
        )
    );
  }, [ngrokTunnel, ngrokStreaming]);

  useEffect(() => {
    let ngrokStreamLock = -1;

    if (ngrokStreaming) {
      console.log("starting ngrok stream", ngrokTunnel);
      ngrokStreamLock = window.setTimeout(function pollStream() {
        console.log("requesting new data...", ngrokTunnel);
        fetch(`${ngrokTunnel}api/requests/http`, {
          headers: {
            Accept: "application/json",
          },
        })
          .then((response) => response.json())
          .then(parseNgrokRequests)
          .then(({ entries }) => {
            addRequests(entries);
            ngrokStreamLock = window.setTimeout(
              pollStream,
              ngrokStreamInterval
            );
          })
          .catch(() => setNgrokStreaming(false));
      }, 0);
    }

    return () => {
      if (ngrokStreamLock !== -1) clearTimeout(ngrokStreamLock);
    };
  }, [addRequests, ngrokStreaming, ngrokTunnel]);

  switch (application) {
    case "debugger":
      return (
        <>
          <a
            class="button is-outlined is-small control"
            onClick={clearRequests}
          >
            Clear Events
          </a>
          <a
            class="button is-outlined is-small control"
            onClick={changeToSchemaManager}
          >
            Manage Schemas
          </a>
          <a class="button is-outlined is-small control" onClick={badRowsModal}>
            Import Bad Rows
          </a>
          <a class="button is-outlined is-small control" onClick={streamModal}>
            Stream Live Data
          </a>
          <a class="button is-outlined is-small control" onClick={importHar}>
            Import HAR Session
          </a>
          <a class="button is-outlined is-small control" onClick={ngrokHandler}>
            {ngrokStreaming
              ? "Stop Universal Debugger"
              : "Start Universal Debugger"}
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

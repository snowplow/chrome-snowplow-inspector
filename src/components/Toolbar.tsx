import { Har } from "har-format";
import { h, FunctionComponent, Fragment } from "preact";
import { useCallback, useState } from "preact/hooks";

import { landingUrl } from "../ts/analytics";
import { IToolbar, NgrokEvent } from "../ts/types";
import { isSnowplow, ngrokEventToHAR, parseNgrokRequests } from "../ts/util";
import { request as requestPerms } from "../ts/permissions";

const ngrokStreamInterval: number = 100;

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
  const [ngrokStreamLock, setNgrokStreamLock] = useState(-1);
  const [ngrokStreaming, setNgrokStreaming] = useState(false);

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

  const toggleNgrokTunnel = useCallback(() => {
    var API_HOST = "http://localhost:4040/";

    chrome.storage.sync.get(
      { tunnelAddress: "http://localhost:4040/" },
      (settings) => {
        API_HOST = settings.tunnelAddress;
      }
    );

    if (ngrokStreaming == true) {
      setNgrokStreamLock(-1);
      setNgrokStreaming(false);
      console.log("stopping ngrok stream");
    } else {
      console.log("starting ngrok stream");
      requestPerms(API_HOST).then(() => {
        setNgrokStreamLock(
          window.setTimeout(function pollStream() {
            console.log("requesting new data...", ngrokStreamLock);
            fetch(`${API_HOST}api/requests/http`, {
              headers: {
                Accept: "application/json",
              },
            })
              .then((response) => response.json())
              .then(parseNgrokRequests)
              .then(({ entries }) => {
                addRequests(entries);

                // setStreamLock(
                //   window.setTimeout(function pollStream() {
                //     fetch(plainUri, { headers })
                //       .then((resp) => resp.json())

                //         setStreamLock((streamLock) =>
                //           streamLock === -1
                //             ? -1
                //             : window.setTimeout(pollStream, 1500)
                //         );
                //       });
                //   }, 1000)
                // );

                setNgrokStreamLock((ngrokStreamLock) => {
                  if (ngrokStreamLock === -1) {
                    console.log("returning -1");
                    return -1;
                  } else {
                    console.log("setting a timeout?");
                    return window.setTimeout(pollStream, 1500);
                  }
                });
              });
          }, ngrokStreamInterval)
        );
      });
    }
  }, [addRequests]);

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
          <a
            class="button is-outlined is-small control"
            onClick={() => {
              setNgrokStreamLock((ngrokStreamLock) => {
                if (ngrokStreamLock !== -1) clearTimeout(ngrokStreamLock);
                return -1;
              });
              setNgrokStreaming(false);
              toggleNgrokTunnel();
            }}
          >
            {/* this text doesn't update after the tunnel has been restarted (from stopped) */}
            {ngrokStreamLock == -1
              ? "Start Universal debugger"
              : "Stop Universal debugger" + JSON.stringify(ngrokStreamLock)}
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

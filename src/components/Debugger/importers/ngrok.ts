import { Entry } from "har-format";
import { StateUpdater } from "preact/hooks";

import { immediatelyRequest } from "../../../ts/permissions";
import { parseNgrokRequests } from "../../../ts/util";

const ngrokStreamInterval: number = 1500;

export default (
  cb: (entries: Entry[]) => void,
  ngrokStreaming: boolean,
  setNgrokStreaming: StateUpdater<boolean>,
) => {
  let ngrokStreamLock = -1;

  if (ngrokStreaming) {
    ngrokStreamLock = window.setTimeout(() => {
      chrome.storage.sync.get(
        { tunnelAddress: "http://localhost:4040/" },
        ({ tunnelAddress }) => {
          console.log("starting ngrok stream", tunnelAddress);
          chrome.permissions.contains({ origins: [tunnelAddress] }, (granted) =>
            (granted
              ? Promise.resolve()
              : immediatelyRequest([tunnelAddress])
            ).then(function pollStream() {
              console.log("requesting new data...", tunnelAddress);
              fetch(`${tunnelAddress}api/requests/http`, {
                headers: {
                  Accept: "application/json",
                },
              })
                .then((response) => response.json())
                .then(parseNgrokRequests)
                .then(({ entries }) => {
                  cb(entries);
                  ngrokStreamLock = window.setTimeout(
                    pollStream,
                    ngrokStreamInterval,
                  );
                })
                .catch(() => setNgrokStreaming(false));
            }),
          );
        },
      );
    }, 0);
  }

  return () => {
    if (ngrokStreamLock !== -1) clearTimeout(ngrokStreamLock);
  };
};

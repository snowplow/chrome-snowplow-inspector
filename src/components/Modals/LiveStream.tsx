import { SearchResponse } from "elasticsearch";
import { Entry } from "har-format";
import { h, FunctionComponent } from "preact";
import { StateUpdater, useMemo, useState } from "preact/hooks";

import { esToRequests } from "../../ts/util";
import { request as requestPerms } from "../../ts/permissions";
import { ModalOptions } from ".";

export interface LiveStreamOptions extends ModalOptions {
  addRequests: (reqs: Entry[]) => void;
  streamLock?: number;
  setStreamLock: StateUpdater<number>;
}

export const LiveStream: FunctionComponent<LiveStreamOptions> = ({
  setModal,
  addRequests,
  streamLock,
  setStreamLock,
}) => {
  const [endpoint, setEndpoint] = useState("");
  const [index, setIndex] = useState("");
  const [query, setQuery] = useState("");

  const uri = useMemo(() => {
    try {
      const esUrl = new URL(endpoint);

      const pathparts = esUrl.pathname.split("/").filter((x) => !!x);
      pathparts.push(index);
      pathparts.push("_search");

      esUrl.pathname = pathparts.join("/");
      esUrl.searchParams.set("size", "50");
      esUrl.searchParams.set("q", query || "*");

      return esUrl;
    } catch (e) {
      return null;
    }
  }, [endpoint, index, query]);

  return (
    <div class="modal is-active">
      <div class="modal-background" onClick={() => setModal()}>
        <form
          class="modal-card"
          onSubmit={(e) => {
            e.preventDefault();

            if (!e.currentTarget.reportValidity() || !uri) return;

            requestPerms(`*://${uri.hostname}/*`).then(() => {
              const seenEvents = new Set();
              const plainUri = `${uri.protocol}//${uri.host}${uri.pathname}${uri.search}`;
              const headers: Record<string, string> = {};

              if (uri.username || uri.password) {
                headers["Authorization"] = btoa(
                  `${uri.username}:${uri.password}`
                );
              }

              let timeoutId = window.setTimeout(function pollStream() {
                fetch(plainUri, { headers })
                  .then((resp) => resp.json())
                  .then((resp) => {
                    const hits = (
                      resp as SearchResponse<object>
                    ).hits.hits.filter((x) => !seenEvents.has(x._id));
                    hits.forEach((x) => seenEvents.add(x._id));

                    if (hits.length) {
                      addRequests(esToRequests(hits.map((x) => x._source)));
                    }

                    setStreamLock(
                      (timeoutId = window.setTimeout(pollStream, 1000))
                    );
                  });
              }, 1000);

              setStreamLock(timeoutId);
              setModal();
            });
          }}
        >
          <header class="modal-card-head">
            <p class="modal-card-title">Stream Live Data</p>
            <button class="delete" type="reset" onClick={() => setModal()} />
          </header>
          <section class="modal-card-body">
            <p>
              Inspect live data flowing through into ElasticSearch. This can be
              your production real-tim epipeline, or Snowplow Mini.
            </p>
            <div class="field">
              <label class="label" for="stream-endpoint">
                ElasticSearch Endpoint
              </label>
              <div class="control">
                <input
                  id="stream-endpoint"
                  class="input"
                  name="endpoint"
                  type="url"
                  placeholder="http://es.example.com"
                  required
                  value={endpoint}
                  onInput={({ currentTarget }) =>
                    setEndpoint(currentTarget.value)
                  }
                />
              </div>
            </div>
            <div class="field">
              <label class="label" for="stream-index">
                ElasticSearch Index
              </label>
              <div class="control">
                <input
                  id="stream-index"
                  class="input"
                  name="index"
                  type="text"
                  placeholder="good"
                  required
                  value={index}
                  onInput={({ currentTarget }) => setIndex(currentTarget.value)}
                />
              </div>
            </div>
            <div class="field">
              <label class="label" for="stream-query">
                Filter Query
              </label>
              <div class="control">
                <input
                  id="stream-query"
                  class="input"
                  name="query"
                  type="text"
                  placeholder="*"
                  required
                  value={query}
                  onInput={({ currentTarget }) => setQuery(currentTarget.value)}
                />
              </div>
            </div>
          </section>
          <footer class="modal-card-foot">
            <button class="button">Import</button>
            <button
              class="button"
              disabled={streamLock === -1}
              onClick={() => {
                if (streamLock !== -1) {
                  clearTimeout(streamLock);
                  setStreamLock(-1);
                }
              }}
            >
              Stop Streaming
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

import { SearchResponse } from "elasticsearch";
import { Entry } from "har-format";
import { h, FunctionComponent } from "preact";
import { Dispatch, StateUpdater, useMemo, useState } from "preact/hooks";
import { BaseModal } from "./BaseModal";

import { esToRequests } from "../../ts/util";
import { request as requestPerms } from "../../ts/permissions";
import { ModalOptions } from ".";

export interface LiveStreamOptions extends ModalOptions {
  addRequests: (reqs: Entry[]) => void;
  streamLock?: number;
  setStreamLock: Dispatch<StateUpdater<number>>;
}

export const LiveStream: FunctionComponent<LiveStreamOptions> = ({
  setModal,
  addRequests,
  streamLock,
  setStreamLock,
}) => {
  const [endpoint, setEndpoint] = useState("");
  const [index, setIndex] = useState("");
  const [query, setQuery] = useState("*");

  const [streaming, setStreaming] = useState(streamLock !== -1);

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
    <BaseModal
      title="Stream Live Data"
      onClose={setModal}
      onSubmit={(e) => {
        e.preventDefault();

        if (!e.currentTarget.reportValidity() || !uri) return;

        requestPerms(`*://${uri.hostname}/*`).then(() => {
          const seenEvents = new Set();
          const plainUri = `${uri.protocol}//${uri.host}${uri.pathname}${uri.search}`;
          const headers: Record<string, string> = {};

          if (uri.username || uri.password) {
            headers["Authorization"] = btoa(`${uri.username}:${uri.password}`);
          }

          setStreamLock(
            window.setTimeout(function pollStream() {
              fetch(plainUri, { headers })
                .then((resp) => resp.json())
                .then((resp) => {
                  const hits = (
                    resp as SearchResponse<object>
                  ).hits.hits.filter((x) => !seenEvents.has(x._id));
                  hits.forEach((x) => seenEvents.add(x._id));

                  if (hits.length) {
                    addRequests(
                      esToRequests(
                        hits.map((x) => x._source),
                        index,
                      ),
                    );
                  }

                  setStreamLock((streamLock) =>
                    streamLock === -1
                      ? -1
                      : window.setTimeout(pollStream, 1500),
                  );
                });
            }, 1000),
          );

          setStreaming(true);
        });
      }}
    >
      <section>
        <p>
          Inspect live data flowing through into ElasticSearch. This can be your
          production real-time pipeline, or Snowplow Mini.
        </p>
        <div>
          <label>
            ElasticSearch Endpoint
            <input
              id="stream-endpoint"
              name="endpoint"
              type="url"
              placeholder="http://es.example.com/elasticsearch/"
              required
              value={endpoint}
              onInput={({ currentTarget }) => setEndpoint(currentTarget.value)}
            />
          </label>
        </div>
        <div>
          <label>
            ElasticSearch Index
            <input
              id="stream-index"
              name="index"
              type="text"
              placeholder="good"
              required
              value={index}
              onInput={({ currentTarget }) => setIndex(currentTarget.value)}
            />
          </label>
        </div>
        <div>
          <label>
            Filter Query
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
          </label>
        </div>
      </section>
      <footer>
        <button>Import</button>
        <button
          type="button"
          disabled={!streaming}
          onClick={() => {
            setStreamLock((streamLock) => {
              if (streamLock !== -1) clearTimeout(streamLock);
              return -1;
            });

            setStreaming(false);
          }}
        >
          Stop Streaming
        </button>
      </footer>
    </BaseModal>
  );
};

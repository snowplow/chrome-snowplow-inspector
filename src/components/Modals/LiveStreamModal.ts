import { SearchResponse } from "elasticsearch";
import { default as m, request, Vnode } from "mithril";
import { IBadRowsSummary } from "../../ts/types";
import { esToRequests } from "../../ts/util";

let streamLock: number = -1;

export const LiveStreamModal = {
  view: (vnode: Vnode<IBadRowsSummary>) =>
    m("div.modal.is-active", [
      m("div.modal-background"),
      m(
        "form.modal-card",
        {
          onsubmit: (e: Event) => {
            e.preventDefault();

            const fields = (e.target as HTMLFormElement).elements;
            const esUrl = new URL(
              (fields.namedItem("stream-endpoint") as HTMLInputElement).value
            );

            const pathparts = esUrl.pathname.split("/").filter((x) => !!x);
            pathparts.push(
              (fields.namedItem("stream-index") as HTMLInputElement).value
            );
            pathparts.push("_search");

            esUrl.pathname = pathparts.join("/");
            esUrl.searchParams.set("size", "50");
            esUrl.searchParams.set(
              "q",
              (fields.namedItem("stream-query") as HTMLInputElement).value ||
                "*"
            );

            const seenEvents = new Set();

            const esPermissions = { origins: [`*://${esUrl.hostname}/*`] };
            chrome.permissions.request(esPermissions);

            const url = `${esUrl.protocol}//${esUrl.host}${esUrl.pathname}${esUrl.search}`;

            let timeoutId = window.setTimeout(function pollStream() {
              request({
                password: esUrl.password || undefined,
                url,
                user: esUrl.username || undefined,
              }).then((resp) => {
                const hits = (resp as SearchResponse<object>).hits.hits.filter(
                  (x) => !seenEvents.has(x._id)
                );
                hits.forEach((x) => seenEvents.add(x._id));

                if (hits.length) {
                  vnode.attrs.addRequests(
                    esToRequests(hits.map((x) => x._source))
                  );
                }

                if (streamLock === timeoutId) {
                  streamLock = timeoutId = window.setTimeout(pollStream, 1000);
                }
              });
            }, 1000);
            streamLock = timeoutId;

            vnode.attrs.setModal(undefined);
          },
        },
        [
          m("header.modal-card-head", [
            m("p.modal-card-title", "Stream Live Data"),
            m("button.delete[type=reset]", {
              onclick: () => vnode.attrs.setModal(undefined),
            }),
          ]),
          m("section.modal-card-body", [
            m(
              "p",
              `Inspect live data flowing through into ElasticSearch.
                            This can be your production real-time pipeline, or Snowplow Mini.`
            ),
            m(".field", [
              m("label.label[for=stream-endpoint]", "ElasticSearch Endpoint"),
              m(
                ".control",
                m(
                  "input#stream-endpoint.input[name=endpoint][type=url][required]",
                  {
                    placeholder: "http://es.example.com",
                  }
                )
              ),
            ]),
            m(".field", [
              m("label.label[for=stream-index]", "ElasticSearch Index"),
              m(
                ".control",
                m("input#stream-index.input[name=index][type=text][required]", {
                  placeholder: "good",
                })
              ),
            ]),
            m(".field", [
              m("label.label[for=stream-query]", "Filter Query"),
              m(
                ".control",
                m("input#stream-query.input[name=query][type=text]", {
                  placeholder: "*",
                })
              ),
            ]),
          ]),
          m("footer.modal-card-foot", [
            m("button.button[type=submit]", "Import"),
            m(
              "button.button",
              {
                disabled: streamLock === -1,
                onclick: () => (streamLock = -1),
              },
              "Stop Streaming"
            ),
          ]),
        ]
      ),
    ]),
};

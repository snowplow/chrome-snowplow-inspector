import { Entry, Request } from "har-format";
import { default as m, Vnode } from "mithril";

import { IBeaconSummary, IDebugger } from "../../ts/types";

import { Beacon } from "./Beacon";
import { Timeline } from "./Timeline";

const spPattern =
  /^[^:]+:\/\/[^/?#;]+(\/[^/]+)*?\/(i\?(tv=|.*&tv=)|com\.snowplowanalytics\.snowplow\/tp2)/i;
const plPattern = /^iglu:[^\/]+\/payload_data/i;

function isSnowplow(request: Request): boolean {
  if (spPattern.test(request.url)) {
    return true;
  } else {
    // It's possible that the request uses a custom endpoint via postPath
    if (request.method === "POST" && typeof request.postData !== "undefined") {
      // Custom endpoints only support POST requests
      try {
        const post = JSON.parse(request.postData.text!) || {};
        return (
          typeof post === "object" &&
          "schema" in post &&
          plPattern.test(post.schema)
        );
      } catch {
        // invalid JSON, not a Snowplow event
      }
    }
  }

  return false;
}

export const Debugger = (vnode: Vnode<IDebugger>) => {
  let active: IBeaconSummary | undefined;
  let filter: RegExp | undefined;

  function setActive(beacon: IBeaconSummary) {
    active = beacon;
  }

  function isActive(beacon: IBeaconSummary) {
    return !!(active && active.id === beacon.id);
  }

  function handleNewRequest(reqs: Entry[]): void {
    vnode.attrs.addRequests(
      reqs.filter(
        (req) =>
          !(
            !isSnowplow(req.request) ||
            req.request.method === "OPTIONS" ||
            req.response.statusText === "Service Worker Fallback Required"
          )
      )
    );
  }

  function handleSingleRequest(req: Entry) {
    handleNewRequest([req]);
  }

  return {
    oninit: () => {
      chrome.devtools.network.getHAR((harLog) => {
        handleNewRequest(
          harLog.entries.filter(
            (entry) =>
              !vnode.attrs.events.find(
                (event) =>
                  event.startedDateTime === entry.startedDateTime &&
                  event.time === entry.time &&
                  event.request.url === entry.request.url &&
                  event._request_id === entry._request_id
              )
          )
        );
      });

      chrome.devtools.network.onRequestFinished.addListener(
        handleSingleRequest
      );
    },
    onremove: () => {
      chrome.devtools.network.onRequestFinished.removeListener(
        handleSingleRequest
      );
    },
    view: () =>
      m("section.columns.section", [
        m(
          "div.column.is-narrow.timeline",
          m(
            "div.panel.filterPanel",
            m("input#filter[type=text][placeholder=Filter]", {
              onkeyup: (e: KeyboardEvent) => {
                const t = e.currentTarget as HTMLInputElement;
                try {
                  const f =
                    t && !!t.value ? new RegExp(t.value, "i") : undefined;
                  filter = f;
                  t.className = "valid";
                } catch (x) {
                  t.className = "invalid";
                }
              },
            })
          ),
          m(Timeline, {
            setActive,
            isActive,
            filter,
            requests: vnode.attrs.events,
          })
        ),
        m(
          "div#beacon.column",
          m(
            "div.tile.is-ancestor.is-vertical.inspector",
            m(Beacon, { activeBeacon: active })
          )
        ),
      ]),
  };
};

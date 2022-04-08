import { Entry, Request } from "har-format";
import { default as m, ClosureComponent } from "mithril";

import { DisplayItem, IBeaconSummary, IDebugger } from "../../ts/types";

import { Beacon } from "./Beacon";
import { TestResults } from "./TestResults";
import { Timeline } from "./Timeline";

/*
  This looks for requests matching known Snowplow endpoints.
  If a POST request doesn't match the pattern, it is still "sniffed" for a Snowplow
  payload, in the event of Custom Post paths.

  TODO(jethron): Make custom paths configurable:-
  There is an issue where beacon requests (POSTs) fired on page navigation sometimes
  have no body; the Content-Length header suggests there should be one but it is inaccessible.
  This makes the hit undetectable to the sniffing above. Custom paths should be
  configurable to catch these cases.

  /i is the traditional "ice" request for GET
  /com.snowplowanalytics.snowplow/tp2 is the default POST parameter endpoint
  /collector/tp2 is a special case for a particular collector using beacon requests (Magento/Adobe: see #44)
 */
const spPattern =
  /^[^:]+:\/\/[^/?#;]+(\/[^/]+)*?\/(i\?(tv=|.*&tv=)|(com\.snowplowanalytics\.snowplow|collector)\/tp2)/i;
const plPattern = /^iglu:[^\/]+\/payload_data/i;
const gaPattern = /\/com\.google\.analytics\/v1/i;

function isSnowplow(request: Request): boolean {
  if (spPattern.test(request.url) || gaPattern.test(request.url)) {
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

export const Debugger: ClosureComponent<IDebugger> = ({
  attrs: { addRequests, events, resolver, setModal },
}) => {
  let active: DisplayItem | undefined;

  function setActive(item: DisplayItem) {
    active = item;
    m.redraw();
  }

  function isActive(beacon: IBeaconSummary) {
    if (active && active.display === "beacon")
      return active.item.id === beacon.id;
    return false;
  }

  function handleNewRequest(reqs: Entry[]): void {
    addRequests(
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
              !events.find(
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
        m(Timeline, {
          setActive,
          isActive,
          displayMode: active ? active.display : "beacon",
          requests: events,
          resolver,
          setModal,
        }),
        !active || active.display === "beacon"
          ? m(
              "div#beacon.column",
              m(
                "div.tile.is-ancestor.is-vertical.inspector",
                m(Beacon, { activeBeacon: active && active.item, resolver })
              )
            )
          : m(
              "div#testdetail.column",
              m(
                "div.tile.is-ancestor.is-vertical",
                m(TestResults, { activeSuite: active.item, setActive })
              )
            ),
      ]),
  };
};

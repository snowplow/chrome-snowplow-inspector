import { newTracker, trackStructEvent } from "@snowplow/browser-tracker";

import { RegistrySpec } from "./iglu/Registries";

const SNOWPLOW_ENDPOINT = "https://d.poplindata.com";

newTracker("sp", SNOWPLOW_ENDPOINT, {
  appId: "snowplow-chrome-extension",
  platform: "app",
});

const seenCollectors: { [collector: string]: string[] } = {};

export const trackerAnalytics = (
  collector: string,
  pageUrl?: string,
  appId?: string
) => {
  if (!pageUrl) {
    return;
  }
  collector = collector.toLowerCase();
  try {
    pageUrl = new URL(pageUrl).host.toLowerCase();
  } catch (e) {
    console.log(`Could not parse URL: ${pageUrl}`);
    return;
  }

  if (pageUrl === "badbucket.invalid" || pageUrl === "elasticsearch.invalid") {
    return;
  }

  appId = (appId || "").toLowerCase();

  const appKey = pageUrl + ":" + appId;

  if (!(collector in seenCollectors)) {
    seenCollectors[collector] = [];
  }

  if (!seenCollectors[collector].includes(appKey)) {
    seenCollectors[collector].push(appKey);

    chrome.storage.sync.get({ enableTracking: true }, (settings) => {
      if (settings.enableTracking) {
        trackStructEvent({
          category: "New Tracker",
          action: collector,
          label: pageUrl,
          property: appId,
        });
      }
    });
  }
};

export const repoAnalytics = (
  kind: RegistrySpec["kind"],
  name: string,
  uri?: URL
) => {
  chrome.storage.sync.get({ enableTracking: true }, (settings) => {
    if (settings.enableTracking) {
      // Don't steal credentials if present
      if (uri) {
        uri.username = "";
        uri.password = "";
      }

      trackStructEvent({
        category: "Custom Repo",
        action: "Loaded",
        label: uri ? uri.href : kind,
        property: name,
      });
    }
  });
};

export const landingUrl =
  "https://poplindata.com/?" +
  [
    "utm_source=debugger%20extension",
    "utm_medium=software",
    "utm_campaign=Chrome%20extension%20debugger%20window%20top-left",
  ].join("&");

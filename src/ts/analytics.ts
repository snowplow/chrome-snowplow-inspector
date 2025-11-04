import {
  newTracker,
  trackSelfDescribingEvent,
  trackStructEvent,
} from "@snowplow/browser-tracker";

import type { RegistrySpec } from "./iglu/Registries";

const SNOWPLOW_ENDPOINT = "https://snowflake-217500-prod1.collector.snplow.net";

const SCHEMA_COLLECTOR_TELEMETRY =
  "iglu:com.snowplowanalytics.telemetry/collector_telemetry/jsonschema/1-0-0" as const;

newTracker("sp", SNOWPLOW_ENDPOINT, {
  appId: "snowplow-chrome-extension",
  platform: "app",
  discoverRootDomain: false,
  anonymousTracking: { withSessionTracking: true },
  stateStorageStrategy: "localStorage",
  eventMethod: "post",
});

const seenCollectors: { [collector: string]: string[] } = {};
const seenEndpoints: { [tracker: string]: string[] } = {};

export const trackerAnalytics = (
  collector: string,
  pageUrl?: string,
  appId?: string,
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

export const endpointAnalytics = (
  tracker: string,
  appId: string,
  collector: string,
  collectorPath: string,
  method: string,
  status: number,
) => {
  collector = collector.toLowerCase();
  const endpointKey = [tracker, collector, collectorPath, method].join(":");

  if (!(tracker in seenEndpoints)) {
    seenEndpoints[tracker] = [];
  }

  if (!seenEndpoints[tracker].includes(endpointKey)) {
    seenEndpoints[tracker].push(endpointKey);

    chrome.storage.sync.get({ enableTracking: true }, (settings) => {
      if (settings.enableTracking) {
        trackStructEvent({
          category: "New Endpoint",
          action: tracker,
          label: collector + collectorPath,
          property: method,
          value: status,
        });

        trackSelfDescribingEvent({
          event: {
            schema: SCHEMA_COLLECTOR_TELEMETRY,
            data: {
              collectorHost: collector,
              collectorPath: collectorPath,
              appId: appId || tracker || undefined,
              statusCode: status,
              method,
            },
          },
        });
      }
    });
  }
};

export const consoleAnalytics = (
  action: string,
  label?: string,
  property?: string,
  value?: number,
) => {
  chrome.storage.sync.get({ enableTracking: true }, (settings) => {
    if (settings.enableTracking) {
      trackStructEvent({
        category: "Console Auth",
        action,
        label,
        property,
        value,
      });
    }
  });
};

export const repoAnalytics = (
  kind: RegistrySpec["kind"],
  name: string,
  uri?: URL,
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

export const errorAnalytics = (error: unknown) => {
  if (error instanceof Error) {
    trackStructEvent({
      category: "Unhandled Error",
      action: error.name,
      label: error.message,
    });
  } else if (typeof error !== "string") {
    try {
      error = JSON.stringify(error);
    } catch (e) {
      error = String(error).concat(": ", String(e));
    }
    trackStructEvent({
      category: "Unhandled Error",
      action: "ObjectError",
      label: String(error),
    });
  } else {
    trackStructEvent({
      category: "Unhandled Error",
      action: "StringError",
      label: error,
    });
  }
};

export const utmify = (
  url: string | URL,
  params?: Record<string, string>,
): string => {
  const parsed = new URL(url);

  parsed.searchParams.set("utm_source", "debugger extension");
  parsed.searchParams.set("utm_medium", "software");

  Object.entries(params ?? {}).forEach(([k, v]) =>
    parsed.searchParams.set(k, v),
  );

  return parsed.href;
};

export const landingUrl = utmify("https://snowplow.io/", {
  utm_campaign: "Chrome extension debugger window top-left",
});

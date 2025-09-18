import type { Entry, Har } from "har-format";

export default (requests: Entry[]): File => {
  const manifest = chrome.runtime.getManifest();
  const har: Har = {
    log: {
      version: "1.1",
      entries: requests,
      creator: {
        name: manifest.name,
        version: manifest.version,
      },
    },
  };

  return new File(
    [new Blob([JSON.stringify(har)], { type: "application/json" })],
    "Snowplow Inspector Export.har",
  );
};

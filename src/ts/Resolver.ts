import analytics = require("./analytics");
import Registries = require("./Registries");
import Registry = require("./Registries/Registry");
import { RegistrySpec } from "./types";

const DEFAULT_REGISTRIES: RegistrySpec[] = [
  { kind: "local" },
  { kind: "static" },
];

class Resolver {
  registries: Registry[];

  constructor() {
    this.registries = [];

    chrome.storage.sync.get({ registries: DEFAULT_REGISTRIES }, (settings) => {
      for (const repo of settings.registries) {
        this.registries.push(Registries.build(repo));
        //analytics.repoAnalytics(repo);
      }
    });
  }
}

export = Resolver;

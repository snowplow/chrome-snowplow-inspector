import m = require("mithril");

import analytics = require("./analytics");
import Registries = require("./Registries");
import Registry = require("./Registries/Registry");
import { RegistrySpec } from "./types";

const DEFAULT_REGISTRIES: RegistrySpec[] = [
  { kind: "local", name: "Local Registry" },
  { kind: "static", name: "Iglu Central", uri: "http://iglucentral.com" },
];

class Resolver extends Registry {
  readonly registries: Registry[];

  constructor() {
    super({ kind: "local", name: "Resolver" });

    this.registries = [];

    chrome.storage.sync.get({ registries: DEFAULT_REGISTRIES }, (settings) => {
      for (const repo of settings.registries) {
        this.registries.push(Registries.build(repo));
        //analytics.repoAnalytics(repo);
      }
    });
  }

  view() {
    return m("span.resolver");
  }

  walk() {
    return Array.prototype.concat.apply(
      [],
      this.registries.map((r) => r.walk())
    );
  }
}

export = Resolver;

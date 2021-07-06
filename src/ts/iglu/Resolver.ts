import { default as m } from "mithril";

import { build } from "./Registries";
import { Registry } from "./Registries/Registry";
import { IgluSchema, IgluUri, RegistrySpec, RegistryStatus } from "../types";

const DEFAULT_REGISTRIES: RegistrySpec[] = [
  { kind: "local", name: "Local Registry" },
  { kind: "static", name: "Iglu Central", uri: "http://iglucentral.com" },
];

export class Resolver extends Registry {
  readonly registries: Registry[];

  constructor() {
    super({ kind: "local", name: "Resolver" });

    this.registries = [];

    chrome.storage.sync.get({ registries: DEFAULT_REGISTRIES }, (settings) => {
      for (const repo of settings.registries) {
        this.registries.push(build(repo));
      }
    });
  }

  resolve(schema: IgluUri | IgluSchema) {}

  status() {
    return Promise.all(this.registries.map((r) => r.status())).then((s) =>
      s.reduce((res, s) => (s === "OK" ? res : "UNHEALTHY"), "OK")
    );
  }

  view() {
    return m("span.resolver");
  }

  walk() {
    return Promise.all(
      this.registries.map((reg) => reg.walk().catch(() => [] as IgluSchema[]))
    ).then((...args) => Array.prototype.concat.apply([], args));
  }
}

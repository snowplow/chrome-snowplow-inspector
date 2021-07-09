import { default as m } from "mithril";

import { build } from "./Registries";
import { Registry } from "./Registries/Registry";
import { IgluSchema, IgluUri, ResolvedIgluSchema } from "./IgluSchema";
import { RegistrySpec, RegistryStatus } from "../types";

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

  resolve(schema: IgluSchema) {
    // .all rejects on first rejection, otherwise waiting for fulfillment
    // invert rejections to successes and the first success to an error to early abort
    return Promise.all(
      this.registries.map((r) =>
        r.resolve(schema).then(
          (res) => Promise.reject<ResolvedIgluSchema>(res),
          () => Promise.resolve(null)
        )
      )
    ).then(
      () => Promise.reject(null), // everything rejected
      (res) => Promise.resolve<ResolvedIgluSchema>(res) // successfully found schema
    );
  }

  status() {
    return Promise.all(this.registries.map((r) => r.status())).then((s) =>
      s.reduce((res, s) => (s === "OK" ? res : "UNHEALTHY"), "OK")
    );
  }

  view() {
    return m(
      "ol",
      this.registries.map((reg) => m(reg))
    );
  }

  walk() {
    return Promise.all(
      this.registries.map((reg) => reg.walk().catch(() => [] as IgluSchema[]))
    ).then((args) => ([] as IgluSchema[]).concat(...args));
  }
}

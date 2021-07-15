import { default as m } from "mithril";

import { build } from "./Registries";
import { Registry } from "./Registries/Registry";
import { IgluSchema, IgluUri, ResolvedIgluSchema } from "./IgluSchema";
import { ExtensionOptions, RegistrySpec, RegistryStatus } from "../types";

const DEFAULT_REGISTRIES: RegistrySpec[] = [
  { kind: "local", name: "Local Registry" },
  { kind: "static", name: "Iglu Central", uri: "http://iglucentral.com" },
];

export class Resolver extends Registry {
  readonly registries: Registry[];

  constructor() {
    super({ kind: "local", name: "Resolver" });

    this.registries = [];

    // migrate old local schemas
    chrome.storage.local.get(
      ["schemalist", "localSchemas"],
      (storage: Partial<ExtensionOptions>) => {
        const MIGRATION_NAME = "Migrated Local Registry";

        const { schemalist, localSchemas } = storage;
        const ls = localSchemas ? JSON.parse(localSchemas) : {};
        if (Array.isArray(schemalist) && schemalist.length) {
          DEFAULT_REGISTRIES.push({ kind: "local", name: MIGRATION_NAME });

          const schemas: ResolvedIgluSchema[] = [];
          const remainder: any[] = [];

          schemalist.forEach((s) => {
            const data = typeof s === "string" ? JSON.parse(s) : s;
            if (typeof s === "object" && s && "self" in s) {
              const { vendor, name, format, version } = s["self"];

              const built = IgluSchema.fromUri(
                `iglu:${vendor}/${name}/${format}/${version}`
              );
              if (built) {
                const res = built.resolve(s, this);
                if (res) schemas.push(res);
              }
            } else {
              remainder.push(JSON.stringify(s));
            }
          });

          ls[MIGRATION_NAME] = (ls[MIGRATION_NAME] || []).concat(schemas);
          chrome.storage.local.set({
            schemalist: remainder,
            localSchemas: JSON.stringify(ls),
          });
        }
      }
    );

    chrome.storage.sync.get(
      {
        registries: DEFAULT_REGISTRIES.map((r) => JSON.stringify(r)),
        repolist: [],
      },
      (settings) => {
        for (const repo of settings.registries as string[]) {
          this.registries.push(build(JSON.parse(repo)));
        }

        // handle legacy repo settings
        if (this.importLegacy(settings.repolist, this.registries))
          chrome.storage.sync.set({
            registries: this.registries.map((r) => JSON.stringify(r)),
            repolist: [],
          });
      }
    );
  }

  private importLegacy(repolist: string[], current: Registry[]): boolean {
    const migrated: Registry[] = [];

    for (const legacy of repolist) {
      const uri = new URL(legacy);

      let handled = false;
      for (const repo of current) {
        if (repo.opts["uri"] === legacy) handled = true;
        if (/\/api$/i.test(legacy) && repo.spec.kind === "iglu") {
          if (
            repo.opts["uri"] === uri.origin + uri.pathname &&
            uri.username === repo.opts["apiKey"]
          )
            handled = true;
        }
      }

      if (!handled) {
        if (/\/api$/i.test(legacy)) {
          migrated.push(
            build({
              kind: "iglu",
              name: legacy,
              uri: uri.origin + uri.pathname,
              apiKey: uri.username,
            })
          );
        } else {
          migrated.push(
            build({ kind: "static", name: uri.hostname, uri: uri.href })
          );
        }
      }
    }

    Array.prototype.push.apply(current, migrated);
    return migrated.length > 0;
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

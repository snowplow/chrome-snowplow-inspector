import { default as m, Vnode } from "mithril";

import { build } from "./Registries";
import { Registry } from "./Registries/Registry";
import { IgluSchema, IgluUri, ResolvedIgluSchema } from "./IgluSchema";
import { ExtensionOptions, RegistrySpec } from "../types";

const DEFAULT_REGISTRIES: RegistrySpec[] = [
  { kind: "local", name: "Local Registry", priority: 0 },
  {
    kind: "static",
    name: "Iglu Central",
    uri: "http://iglucentral.com",
    manifestUri:
      "https://api.github.com/repos/snowplow/iglu-central/git/trees/master?recursive=1",
    priority: 0,
  },
];

export class Resolver extends Registry {
  readonly registries: Registry[];
  readonly hitCache: Map<IgluUri, Registry[]> = new Map();

  constructor() {
    super({ kind: "local", name: "Resolver" });

    this.registries = [];

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
        this.importLegacyLocalSchemas()
          .then(() =>
            this.importLegacyRepos(settings.repolist, this.registries)
          )
          .then(
            (migrated) =>
              new Promise<void>((fulfil) =>
                migrated
                  ? chrome.storage.sync.set(
                      {
                        registries: this.registries.map((r) =>
                          JSON.stringify(r)
                        ),
                        repolist: [],
                      },
                      fulfil
                    )
                  : fulfil()
              )
          )
          .then(() =>
            this.registries.sort((a, b) => {
              const ap = a.priority || Number.MAX_SAFE_INTEGER;
              const bp = b.priority || Number.MAX_SAFE_INTEGER;

              let result = ap - bp;

              const kindPriority: RegistrySpec["kind"][] = [
                "local",
                "ds",
                "iglu",
                "static",
              ];
              if (!result)
                result +=
                  kindPriority.indexOf(a.spec.kind) -
                  kindPriority.indexOf(b.spec.kind);

              return result;
            })
          );
      }
    );
  }

  private importLegacyLocalSchemas() {
    return new Promise<void>((fulfil) => {
      chrome.storage.local.get(
        ["schemalist", "localSchemas"],
        (storage: Partial<ExtensionOptions>) => {
          const MIGRATION_NAME = "Migrated Local Registry";

          const { schemalist, localSchemas } = storage;
          const ls = localSchemas ? JSON.parse(localSchemas) : {};
          if (Array.isArray(schemalist) && schemalist.length) {
            DEFAULT_REGISTRIES.push({
              kind: "local",
              name: MIGRATION_NAME,
              priority: 0,
            });

            const schemas: ResolvedIgluSchema[] = [];
            const remainder: any[] = [];

            schemalist.forEach((s) => {
              const data = typeof s === "string" ? JSON.parse(s) : s;
              if (typeof data === "object" && data && "self" in data) {
                const { vendor, name, format, version } = data["self"];

                const built = IgluSchema.fromUri(
                  `iglu:${vendor}/${name}/${format}/${version}`
                );
                if (built) {
                  const res = built.resolve(data, this);
                  if (res) schemas.push(res);
                }
              } else {
                remainder.push(JSON.stringify(data));
              }
            });

            ls[MIGRATION_NAME] = (ls[MIGRATION_NAME] || []).concat(schemas);
            chrome.storage.local.set(
              {
                schemalist: remainder,
                localSchemas: JSON.stringify(ls),
              },
              fulfil
            );
          } else fulfil();
        }
      );
    });
  }

  private importLegacyRepos(repolist: string[], current: Registry[]): boolean {
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
    const candidates = this.hitCache.get(schema.uri()) || this.registries;
    // .all rejects on first rejection, otherwise waiting for fulfillment
    // invert rejections to successes and the first success to an error to early abort
    return Promise.all(
      candidates.map((r) =>
        r.resolve(schema).then(
          (res) => Promise.reject<ResolvedIgluSchema>(res),
          () => Promise.resolve()
        )
      )
    ).then(
      () => Promise.reject(), // everything rejected
      (res: ResolvedIgluSchema) => Promise.resolve(res) // successfully found schema
    );
  }

  status() {
    return Promise.all(this.registries.map((r) => r.status())).then((s) =>
      s.reduce(
        (res, s) => (s === "OK" || s === "WAITING" ? res : "UNHEALTHY"),
        "OK"
      )
    );
  }

  view(
    vnode: Vnode<{
      selectRegistries: (selected: Registry[]) => void;
      shouldClear: boolean;
      setClear: (_: boolean) => void;
    }>
  ) {
    return m(
      "select[multiple]",
      {
        onupdate: (vnode) => {
          if (vnode.attrs.shouldClear) {
            if (
              typeof vnode.tag === "string" &&
              vnode.tag.toLowerCase() === "select"
            ) {
              (vnode.dom as HTMLSelectElement).selectedIndex = -1;
              vnode.attrs.selectRegistries([]);
              vnode.attrs.setClear(false);
              m.redraw();
            }
          }
        },
        onchange: (event: Event) => {
          if (!event.target) return;
          const el = event.target as HTMLSelectElement;
          const opts = Array.from(el.selectedOptions);
          vnode.attrs.selectRegistries(
            Array.from(el.selectedOptions)
              .map((opt) =>
                this.registries.findIndex((r) => r.id === opt.value)
              )
              .filter((i) => i !== -1)
              .map((i) => this.registries[i])
          );
        },
        size: this.registries.length,
        ...vnode.attrs,
      },
      this.registries.map((reg) => m(reg, { key: reg.id }))
    );
  }

  walk() {
    return Promise.all(
      this.registries.map((reg) =>
        reg
          .walk()
          .catch(() => [] as IgluSchema[])
          .then((schemas) => {
            for (const s of schemas) {
              const uri = s.uri();
              if (!this.hitCache.has(uri)) this.hitCache.set(uri, [reg]);
              else this.hitCache.get(uri)?.push(reg);
            }

            return schemas;
          })
      )
    ).then((args) => {
      return ([] as IgluSchema[]).concat(...args);
    });
  }
}

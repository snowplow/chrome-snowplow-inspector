import { buildRegistry } from ".";
import { Registry } from "./Registries/Registry";
import { IgluSchema, IgluUri, ResolvedIgluSchema } from "./IgluSchema";
import { repoAnalytics } from "../analytics";
import { ExtensionOptions, RegistrySpec } from "../types";

const DEFAULT_REGISTRIES: RegistrySpec[] = [
  { kind: "local", name: "Local Registry", priority: 0 },
  {
    kind: "static",
    name: "Iglu Central",
    uri: "http://iglucentral.com",
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
      ({ registries, repolist }) => {
        let defaultRepos = false;
        for (const repo of registries as string[]) {
          const spec = JSON.parse(repo);
          defaultRepos = defaultRepos || !spec.id;
          const built = buildRegistry(JSON.parse(repo));
          repoAnalytics(
            built.spec.kind,
            built.spec.name,
            built.spec.uri && new URL(built.spec.uri),
          );
          this.registries.push(built);
        }

        if (defaultRepos) this.persist();

        // handle legacy repo settings
        this.importLegacyLocalSchemas()
          .then(() => this.importLegacyRepos(repolist, this.registries))
          .then((migrated) => void (migrated && this.persist()))
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
            }),
          );
      },
    );
  }

  private importLegacyLocalSchemas() {
    return new Promise<void>((fulfil) => {
      chrome.storage.local.get(
        ["schemalist", "localSchemas"],
        ({ schemalist, localSchemas }: Partial<ExtensionOptions>) => {
          const MIGRATION_NAME = "Migrated Local Registry";
          const ls = localSchemas ? JSON.parse(localSchemas) : {};
          if (Array.isArray(schemalist) && schemalist.length) {
            const schemas: ResolvedIgluSchema[] = [];
            const remainder: any[] = [];

            schemalist.forEach((s) => {
              const data = typeof s === "string" ? JSON.parse(s) : s;
              if (typeof data === "object" && data && "self" in data) {
                const { vendor, name, format, version } = data["self"];

                const built = IgluSchema.fromUri(
                  `iglu:${vendor}/${name}/${format}/${version}`,
                );
                if (built) {
                  const res = built.resolve(data, this);
                  if (res) schemas.push(res);
                }
              } else {
                remainder.push(JSON.stringify(data));
              }
            });

            let registry = this.registries.find(
              ({ spec: { kind, name } }) =>
                kind === "local" && name === MIGRATION_NAME,
            );
            if (!registry)
              this.registries.push(
                (registry = buildRegistry({
                  kind: "local",
                  name: MIGRATION_NAME,
                  priority: 0,
                })),
              );

            ls[registry.id] = (ls[registry.id] || []).concat(schemas);

            chrome.storage.local.set(
              {
                schemalist: remainder,
                localSchemas: JSON.stringify(ls),
              },
              fulfil,
            );
          } else fulfil();
        },
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
            buildRegistry({
              kind: "iglu",
              name: legacy,
              uri: uri.origin + uri.pathname,
              apiKey: uri.username,
            }),
          );
        } else {
          migrated.push(
            buildRegistry({
              kind: "static",
              name: uri.hostname,
              uri: uri.href,
            }),
          );
        }
      }
    }

    Array.prototype.push.apply(current, migrated);
    return migrated.length > 0;
  }

  resolve(schema: IgluSchema, exclude?: Registry[]) {
    if (schema instanceof ResolvedIgluSchema) {
      return Promise.resolve(schema);
    }
    const candidates = this.hitCache.get(schema.uri()) || this.registries;

    // .all rejects on first rejection, otherwise waiting for fulfillment
    // invert rejections to successes and the first success to an error to early abort
    return Promise.all(
      candidates.map((r) =>
        r.resolve(schema).then(
          (res) => {
            if (
              exclude !== undefined &&
              exclude.find((reg) => res.registry.id === reg.id)
            )
              return Promise.resolve();

            return Promise.reject(res);
          },
          () => Promise.resolve(),
        ),
      ),
    )
      .then(
        () => Promise.reject(), // everything rejected
        (res: ResolvedIgluSchema) => Promise.resolve(res), // successfully found schema
      )
      .then((res) => {
        if (exclude !== undefined) exclude.push(res.registry);
        if (res.registry.updated)
          this.persist().then(() => (res.registry.updated = false));
        return res;
      });
  }

  status() {
    return Promise.all(this.registries.map((r) => r.status())).then((s) =>
      s.reduce((res, s) => (s === "OK" ? res : "UNHEALTHY"), "OK"),
    );
  }

  walk() {
    this.hitCache.clear();
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
          }),
      ),
    ).then((args) => {
      return ([] as IgluSchema[]).concat(...args);
    });
  }

  _walk() {
    return this.walk();
  }

  remove(...registries: Registry[]) {
    const removed: Registry[] = [];
    for (const reg of registries) {
      for (let i = 0; i < this.registries.length; i++) {
        if (this.registries[i].id === reg.id) {
          removed.push(...this.registries.splice(i, 1));
          break;
        }
      }
    }

    const remIds = new Set(removed.map((r) => r.id));
    for (const [key, regs] of this.hitCache) {
      this.hitCache.set(
        key,
        regs.filter((reg) => !remIds.has(reg.id)),
      );
    }

    return removed;
  }

  import(strict: boolean, ...registries: Registry[]) {
    for (const reg of registries) {
      const { id } = reg;
      let replaced = false;
      for (let i = 0; i < this.registries.length; i++) {
        const existing = this.registries[i];
        if (strict) {
          if (existing.id === id) {
            this.registries[i] = reg;
            replaced = true;
            break;
          }
        } else if (existing.spec.kind === reg.spec.kind) {
          switch (reg.spec.kind) {
            case "local":
              replaced = true;
              continue;
            case "static":
            case "iglu":
            case "ds":
              let matches = 0;
              let opts = 0;
              for (const [p, v] of Object.entries(existing.opts)) {
                opts++;
                if (reg.opts[p] === v) {
                  matches++;
                }
              }

              if (matches) {
                if (opts !== matches) this.registries[i] = reg;
                replaced = true;
              }
          }
        }
      }

      if (!replaced) this.registries.push(reg);
    }
  }

  persist() {
    return new Promise<void>((fulfil) =>
      chrome.storage.sync.set(
        {
          registries: this.registries.map((r) => JSON.stringify(r)),
        },
        fulfil,
      ),
    );
  }
}

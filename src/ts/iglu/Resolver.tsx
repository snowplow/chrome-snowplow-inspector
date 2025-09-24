import {
  Registry,
  DataStructuresRegistry,
  IgluRegistry,
  LocalRegistry,
  StaticRegistry,
} from "./Registries";
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

export const buildRegistry = (spec: RegistrySpec): Registry => {
  switch (spec.kind) {
    case "ds":
      return new DataStructuresRegistry(spec);
    case "iglu":
      return new IgluRegistry(spec);
    case "local":
      return new LocalRegistry(spec);
    case "static":
      return new StaticRegistry(spec);
  }
  throw new Error(`Unsupported Registry: ${spec}`);
};

export class Resolver extends Registry {
  readonly registries: Registry[];
  readonly hitCache: Map<IgluUri, Registry[]> = new Map();

  constructor() {
    super({ kind: "local", name: "Resolver" });

    this.registries = [];

    chrome.storage.sync.get(
      {
        registries: DEFAULT_REGISTRIES.map((r) => JSON.stringify(r)),
      },
      ({ registries }) => {
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
        });
      },
    );
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
    const permanent: string[] = [];
    for (const r of this.registries) {
      if (r.spec.kind === "ds" && r.opts.useOAuth) continue;

      permanent.push(JSON.stringify(r));
    }
    return new Promise<void>((fulfil) =>
      chrome.storage.sync.set(
        {
          registries: permanent,
        },
        fulfil,
      ),
    );
  }
}

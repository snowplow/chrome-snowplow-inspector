import { default as m } from "mithril";

import { Registry } from "./Registry";
import { IgluSchema, IgluUri, ResolvedIgluSchema } from "../IgluSchema";
import { RegistrySpec } from "../../types";

const REQUEST_TIMEOUT_MS = 5000;

export class StaticRegistry extends Registry {
  private cache: Map<IgluUri, ResolvedIgluSchema> = new Map();
  private readonly base: URL;
  private readonly manifest?: URL;

  constructor(spec: RegistrySpec) {
    super(spec);
    this.base = new URL(spec["uri"]);
    this.manifest = spec["manifestUri"] && new URL(spec["manifestUri"]);
  }

  private fetch(schemaPath: string): ReturnType<typeof fetch> {
    const ac = new AbortController();
    const id = setTimeout(ac.abort.bind(ac), REQUEST_TIMEOUT_MS);

    const opts: Partial<RequestInit> = {
      referrerPolicy: "origin",
      signal: ac.signal,
      credentials: this.base.username ? "include" : "omit",
    };

    return fetch(new URL(schemaPath, this.base).href, opts).then((resp) => {
      clearTimeout(id);
      return resp.ok ? resp : Promise.reject("HTTP_ERROR");
    });
  }

  resolve(schema: IgluSchema) {
    if (this.cache.has(schema.uri())) {
      return Promise.resolve(this.cache.get(schema.uri())!);
    } else {
      this.lastStatus = "WAITING";
      m.redraw();
      return this.fetch(schema.uri().replace("iglu:", "schemas/"))
        .then((res) => res.json())
        .then((result) => {
          const resolved = schema.resolve(result, this);
          this.lastStatus = "OK";
          if (resolved) {
            this.cache.set(schema.uri(), resolved);
            return Promise.resolve(resolved);
          } else return Promise.reject();
        });
    }
  }

  status() {
    return Promise.resolve(this.lastStatus || "OK");
  }

  parseManifest(): Promise<IgluSchema[]> {
    const fileListProps = ["tree", "files", "paths"];
    if (this.manifest) {
      return this.fetch(this.manifest.href)
        .then((res) => res.json())
        .then((man) => {
          let list: unknown[] = [];

          if (typeof man === "object" && man) {
            if (Array.isArray(man)) {
              list = man;
            } else {
              for (const p of fileListProps) {
                if (man.hasOwnProperty(p) && Array.isArray(man[p])) {
                  list.push(...man[p]);
                }
              }
            }

            return list
              .filter(
                (val: unknown): val is string | { path: string } =>
                  typeof val === "string" ||
                  (typeof val === "object" &&
                    !!val &&
                    typeof (val as any)["path"] === "string")
              )
              .map((almostSchema): IgluUri | null => {
                const maybeUri =
                  typeof almostSchema === "string"
                    ? almostSchema
                    : almostSchema.path;
                const schemaparts =
                  /(([^\/+])\/([^\/+])\/jsonschema\/([\d+]-[\d+]-[\d+]))(\.json(schema)?)?$/.exec(
                    maybeUri
                  );
                return schemaparts && (("iglu:" + schemaparts[1]) as IgluUri);
              })
              .map((uri) => uri && IgluSchema.fromUri(uri))
              .filter((schema): schema is IgluSchema => schema !== null);
          } else return [];
        });
    } else return Promise.resolve([]);
  }

  walk() {
    return this.parseManifest().then((claimed) => {
      const claimedUris = claimed.map(String);
      const cachedSchemas: IgluSchema[] = [];
      for (const cached of this.cache.values()) {
        if (!claimedUris.includes(cached.toString())) {
          cachedSchemas.push(cached);
        }
      }

      return claimed.concat(cachedSchemas);
    });
  }
}

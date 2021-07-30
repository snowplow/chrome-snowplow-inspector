import { default as m } from "mithril";

import { Registry } from "./Registry";
import { IgluSchema, IgluUri, ResolvedIgluSchema } from "../IgluSchema";
import { RegistrySpec } from "../../types";

const REQUEST_TIMEOUT_MS = 5000;

export class StaticRegistry extends Registry {
  private cache: Map<IgluSchema, ResolvedIgluSchema> = new Map();
  private readonly base: URL;
  private readonly manifest: string;

  constructor(spec: RegistrySpec) {
    super(spec);
    this.base = new URL(spec["uri"]);
    this.manifest = spec["manifestUri"];
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
    if (this.cache.has(schema)) {
      return Promise.resolve(this.cache.get(schema)!);
    } else {
      this.lastStatus = "WAITING";
      m.redraw();
      return this.fetch(schema.uri().replace("iglu:", "schemas/"))
        .then((res) => res.json())
        .then((result) => {
          const resolved = schema.resolve(result, this);
          this.lastStatus = "OK";
          if (resolved) {
            this.cache.set(schema, resolved);
            return Promise.resolve(resolved);
          } else return Promise.reject();
        });
    }
  }

  status() {
    return Promise.resolve(this.lastStatus || "OK");
  }

  walk() {
    const schemas: IgluSchema[] = Array.from(this.cache.values());
    if (this.manifest) {
      return this.fetch(this.manifest)
        .then((res) => res.json())
        .then((man) => (Array.isArray(man) ? man.map(IgluSchema.fromUri) : []))
        .then((claimed) => {
          const seen = new Set<string>();

          return schemas
            .concat(claimed.filter((s): s is IgluSchema => s !== null))
            .filter((s) => !seen.has(s.uri()) && seen.add(s.uri()));
        });
    } else return Promise.resolve(schemas);
  }
}

import { default as m } from "mithril";

import { Registry } from "./Registry";
import { IgluSchema, ResolvedIgluSchema } from "../IgluSchema";
import { RegistrySpec, RegistryStatus } from "../../types";

export class StaticRegistry extends Registry {
  private cache: Map<IgluSchema, ResolvedIgluSchema> = new Map();
  private readonly base: URL;

  constructor(spec: RegistrySpec) {
    super(spec);
    this.base = spec["uri"];
  }

  private fetch(schemaPath: string): ReturnType<typeof fetch> {
    const opts: Partial<RequestInit> = {
      referrerPolicy: "origin",
    };

    return fetch(new URL(schemaPath, this.base).href, opts).then((resp) =>
      resp.ok ? resp : Promise.reject("HTTP_ERROR")
    );
  }

  resolve(schema: IgluSchema) {
    if (this.cache.has(schema)) {
      return Promise.resolve(this.cache.get(schema)!);
    } else {
      return this.fetch(schema.uri().replace("iglu:", "schemas/"))
        .then((res) => res.json())
        .then((result) => {
          const resolved = schema.resolve(result, this);
          if (resolved) {
            this.cache.set(schema, resolved);
            return Promise.resolve(resolved);
          } else return Promise.reject();
        });
    }
  }

  status() {
    return Promise.resolve<RegistryStatus>("OK");
  }

  walk() {
    return Promise.resolve(Array.from(this.cache.values()));
  }
}

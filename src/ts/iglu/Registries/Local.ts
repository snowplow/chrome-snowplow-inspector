import { Registry } from "./Registry";
import { ExtensionOptions, RegistrySpec, RegistryStatus } from "../../types";

import { IgluUri, IgluSchema, ResolvedIgluSchema } from "../IgluSchema";

export class LocalRegistry extends Registry {
  private readonly manifest: Map<IgluUri, ResolvedIgluSchema> = new Map();
  lastStatus: RegistryStatus = "OK";

  constructor(spec: RegistrySpec) {
    super(spec);
  }

  fetch() {
    return new Promise<void>((fulfil) =>
      chrome.storage.local.get(
        { localSchemas: "{}" },
        ({ localSchemas }: Partial<ExtensionOptions>) => {
          if (localSchemas && typeof localSchemas === "string") {
            const ls = JSON.parse(localSchemas);
            (ls[this.id] || []).forEach(
              ({
                vendor,
                name,
                format,
                version,
                data,
              }: Record<keyof ResolvedIgluSchema, any>) => {
                const schema = new IgluSchema(vendor, name, format, version);
                const resolved = schema.resolve(data, this);
                if (resolved) this.manifest.set(resolved.uri(), resolved);
              },
            );
          }

          fulfil();
        },
      ),
    );
  }

  resolve(schema: IgluUri | IgluSchema): Promise<ResolvedIgluSchema> {
    if (typeof schema === "string") {
      const s = IgluSchema.fromUri(schema);
      return s ? this.resolve(s) : Promise.reject();
    }

    const r = this.manifest.get(schema.uri());
    return r ? Promise.resolve(r) : Promise.reject();
  }

  status() {
    return Promise.resolve(this.lastStatus);
  }

  _walk() {
    return this.fetch().then(() => Array.from(this.manifest.values()));
  }

  update(schemas: ResolvedIgluSchema[]) {
    return new Promise<void>((fulfil) =>
      chrome.storage.local.get(
        { localSchemas: "{}" },
        ({ localSchemas }: Partial<ExtensionOptions>) => {
          if (localSchemas && typeof localSchemas === "string") {
            const ls = JSON.parse(localSchemas);
            ls[this.id] = schemas;
            chrome.storage.local.set(
              { localSchemas: JSON.stringify(ls) },
              () => {
                this.manifest.clear();
                schemas.forEach((s) => {
                  this.manifest.set(s.uri(), s);
                });
                fulfil();
              },
            );
          }
        },
      ),
    );
  }
}

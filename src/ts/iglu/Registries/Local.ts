import { default as m } from "mithril";

import { Registry } from "./Registry";
import { ExtensionOptions, RegistrySpec, RegistryStatus } from "../../types";

import { IgluUri, IgluSchema, ResolvedIgluSchema } from "../IgluSchema";

export class LocalRegistry extends Registry {
  private readonly defaultOptions: Pick<ExtensionOptions, "localSchemas">;
  private readonly manifest: Map<IgluSchema, ResolvedIgluSchema> = new Map();

  constructor(spec: RegistrySpec) {
    super(spec);

    this.defaultOptions = {
      localSchemas: { [this.spec.name]: [] },
    };

    // migrate old schemas
    chrome.storage.local.get("schemalist", (storage) => {
      const { schemalist } = storage;
      if (Array.isArray(schemalist) && schemalist.length) {
        schemalist.forEach((s) => {
          if (typeof s === "object" && s && "self" in s) {
            const { vendor, name, format, version } = s["self"];

            const built = IgluSchema.fromUri(
              `iglu:${vendor}/${name}/${format}/${version}`
            );
            if (built) {
              const res = built.resolve(s, this);
              if (res) this.manifest.set(built, res);
            }
          }
        });
      }
    });
  }

  resolve(schema: IgluUri | IgluSchema): Promise<ResolvedIgluSchema> {
    if (typeof schema === "string") {
      const s = IgluSchema.fromUri(schema);
      return s ? this.resolve(s) : Promise.reject();
    }

    const r = this.manifest.get(schema);
    return r ? Promise.resolve(r) : Promise.reject();
  }

  status() {
    return Promise.resolve<RegistryStatus>("OK");
  }

  walk() {
    return new Promise<IgluSchema[]>((fulfil) =>
      chrome.storage.local.get(
        "localSchemas",
        (items: Partial<ExtensionOptions>) => {
          if (items.localSchemas)
            items.localSchemas[this.spec.name].forEach((s) =>
              this.manifest.set(s, Object.assign(s, { registry: this }))
            );

          fulfil(Array.from(this.manifest.keys()));
        }
      )
    );
  }
}

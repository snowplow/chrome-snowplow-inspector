import { Registry } from "./Registry";
import { ExtensionOptions, RegistrySpec, RegistryStatus } from "../../types";

import { IgluUri, IgluSchema, ResolvedIgluSchema } from "../IgluSchema";

export class LocalRegistry extends Registry {
  private readonly defaultOptions: Pick<ExtensionOptions, "localSchemas">;
  private readonly manifest: Map<IgluUri, ResolvedIgluSchema> = new Map();

  constructor(spec: RegistrySpec) {
    super(spec);

    this.defaultOptions = {
      localSchemas: JSON.stringify({ [this.spec.name]: [] }),
    };
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
    return Promise.resolve<RegistryStatus>("OK");
  }

  walk() {
    return new Promise<IgluSchema[]>((fulfil) =>
      chrome.storage.local.get(
        "localSchemas",
        (items: Partial<ExtensionOptions>) => {
          if (items.localSchemas) {
            const ls =
              typeof items.localSchemas === "string"
                ? JSON.parse(items.localSchemas)
                : { [this.spec.name]: [] };
            (ls[this.spec.name] || []).forEach(
              (s: Omit<ResolvedIgluSchema, "registry">) =>
                this.manifest.set(
                  s.uri(),
                  Object.assign(Object.create(ResolvedIgluSchema), s, {
                    registry: this,
                  })
                )
            );
          }

          fulfil(Array.from(this.manifest.values()));
        }
      )
    );
  }
}

import { default as m } from "mithril";

import { Registry } from "./Registry";
import {
  ExtensionOptions,
  IgluUri,
  IgluSchema,
  RegistrySpec,
  RegistryStatus,
  ResolvedIgluSchema,
} from "../../types";

export class LocalRegistry extends Registry {
  private readonly defaultOptions: Pick<ExtensionOptions, "localSchemas">;
  private readonly manifest: Map<IgluSchema, ResolvedIgluSchema> = new Map();

  constructor(spec: RegistrySpec) {
    super(spec);

    this.defaultOptions = {
      localSchemas: { [this.spec.name]: [] },
    };
  }

  resolve(schema: IgluUri | IgluSchema) {
    if (typeof schema === "string") {
      return this.resolve(schema as IgluSchema);
    }

    return Promise.resolve(this.manifest.get(schema));
  }

  status() {
    return Promise.resolve<RegistryStatus>("OK");
  }

  view() {
    return m("p", "DataStructure Registry");
  }

  walk() {
    return new Promise<IgluSchema[]>((fulfil) =>
      chrome.storage.local.get(
        "localSchemas",
        (items: Partial<ExtensionOptions>) => {
          if (items.localSchemas) fulfil(items.localSchemas[this.spec.name]);
        }
      )
    );
  }
}

import { default as m } from "mithril";

import { Registry } from "./Registry";
import { IgluSchema, RegistrySpec, RegistryStatus } from "../../types";

export class StaticRegistry extends Registry {
  private schemas: Map<string, IgluSchema> = new Map();

  constructor(spec: RegistrySpec) {
    super(spec);
  }

  resolve() {}

  status() {
    return Promise.resolve<RegistryStatus>("OK");
  }

  view() {
    return m("p", "DataStructure Registry");
  }

  walk() {
    return Promise.resolve(Array.from(this.schemas.values()));
  }
}

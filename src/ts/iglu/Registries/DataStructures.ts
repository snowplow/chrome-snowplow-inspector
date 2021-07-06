import { default as m } from "mithril";

import { Registry } from "./Registry";
import { IgluSchema, RegistrySpec } from "../../types";

export class DataStructuresRegistry extends Registry {
  private schemas: IgluSchema[] = [];

  constructor(spec: RegistrySpec) {
    super(spec);
  }

  walk() {
    return Promise.resolve(this.schemas);
  }
  view() {
    return m("p", "DataStructure Registry");
  }
}

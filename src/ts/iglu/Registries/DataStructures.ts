import { default as m } from "mithril";

import { IgluSchema } from "../";
import { Registry } from "./Registry";
import { RegistrySpec } from "../../types";

export class DataStructuresRegistry extends Registry {
  private schemas: IgluSchema[] = [];

  constructor(spec: RegistrySpec) {
    super(spec);
  }

  resolve() {}

  status() {}

  walk() {
    return Promise.resolve(this.schemas);
  }
}

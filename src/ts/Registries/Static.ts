import m = require("mithril");

import Registry = require("./Registry");
import { RegistrySpec } from "../types";

class StaticRegistry extends Registry {
  constructor(spec: RegistrySpec) {
    super(spec);
  }

  walk() {
    return [];
  }

  view() {
    return m("p", "DataStructure Registry");
  }
}

export = StaticRegistry;

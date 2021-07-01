import m = require("mithril");

import { IgluSchema, RegistrySpec } from "../types";
import util = require("../util");

abstract class Registry {
  id: string;
  spec: RegistrySpec;
  opts?: { [prop: string]: any };

  constructor(spec: RegistrySpec) {
    const { id, name, kind, ...opts } = spec;
    this.id = id || util.uuidv4();
    this.spec = {
      id: this.id,
      name,
      kind,
    };

    this.opts = opts;
  }

  toJSON() {
    return { ...this.spec, ...(this.opts || {}) };
  }

  abstract walk(): IgluSchema[];
  abstract view(): m.Vnode; // Should render the Registry as a list item or form for editing
}

export = Registry;

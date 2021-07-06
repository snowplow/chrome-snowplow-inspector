import { default as m } from "mithril";

import {
  IgluSchema,
  IgluUri,
  RegistrySpec,
  RegistryStatus,
  ResolvedIgluSchema,
} from "../../types";
import { uuidv4 } from "../../util";

export abstract class Registry {
  id: string;
  spec: RegistrySpec;
  opts?: { [prop: string]: any };

  constructor(spec: RegistrySpec) {
    const { id, name, kind, ...opts } = spec;
    this.id = id || uuidv4();
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

  abstract resolve(_: IgluUri): Promise<ResolvedIgluSchema>;
  abstract resolve(_: IgluSchema): Promise<ResolvedIgluSchema>;
  abstract status(): Promise<RegistryStatus>;
  abstract view(): m.Vnode; // Should render the Registry as a list item or form for editing
  abstract walk(): Promise<IgluSchema[]>;
}

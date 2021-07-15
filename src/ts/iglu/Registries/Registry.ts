import { default as m } from "mithril";

import { RegistrySpec, RegistryStatus } from "../../types";
import { IgluSchema, IgluUri, ResolvedIgluSchema } from "../IgluSchema";
import { uuidv4 } from "../../util";

export abstract class Registry {
  id: string;
  spec: RegistrySpec;
  opts: { [prop: string]: any };

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

  view() {
    return m("li", m("textarea", { value: JSON.stringify(this) }));
  }

  abstract resolve(_: IgluSchema): Promise<ResolvedIgluSchema>;
  abstract status(): Promise<RegistryStatus>;
  abstract walk(): Promise<IgluSchema[]>;
}

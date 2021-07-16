import { default as m } from "mithril";

import { RegistrySpec, RegistryStatus } from "../../types";
import { IgluSchema, IgluUri, ResolvedIgluSchema } from "../IgluSchema";
import { uuidv4 } from "../../util";

export abstract class Registry {
  id: string;
  spec: RegistrySpec;
  priority?: number;
  vendorPrefixes?: string[];
  opts: { [prop: string]: any };

  constructor(spec: RegistrySpec) {
    const { id, name, kind, priority, vendorPrefixes, ...opts } = spec;
    this.id = id || uuidv4();
    this.spec = {
      id: this.id,
      name,
      kind,
    };

    this.priority = priority;
    this.vendorPrefixes = vendorPrefixes;

    this.opts = opts;
  }

  toJSON() {
    return { ...this.spec, ...(this.opts || {}) };
  }

  view() {
    return m(
      "li",
      m("textarea", {
        className: `registry ${this.spec.kind} ${
          this.lastStatus ? this.lastStatus.toLowerCase() : ""
        }`,
        value: JSON.stringify(this, null, 4),
      })
    );
  }

  abstract resolve(_: IgluSchema): Promise<ResolvedIgluSchema>;
  abstract status(): Promise<RegistryStatus>;
  abstract walk(): Promise<IgluSchema[]>;
}

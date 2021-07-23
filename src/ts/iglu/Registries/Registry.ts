import { default as m, Vnode } from "mithril";

import { RegistrySpec, RegistryStatus } from "../../types";
import { IgluSchema, ResolvedIgluSchema } from "../IgluSchema";
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

  view(_: Vnode<any>) {
    return m(
      "option",
      {
        className: `registry ${this.spec.kind} ${
          this.lastStatus ? this.lastStatus.toLowerCase() : ""
        }`,
        value: this.spec.id,
      },
      this.spec.name
    );
  }

  abstract resolve(_: IgluSchema): Promise<ResolvedIgluSchema>;
  abstract status(): Promise<RegistryStatus>;
  abstract walk(): Promise<IgluSchema[]>;
}

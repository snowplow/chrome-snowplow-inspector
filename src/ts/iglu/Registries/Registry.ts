import { Validator } from "jsonschema";

import { IgluSchema, ResolvedIgluSchema } from "../IgluSchema";
import { RegistrySpec, RegistryStatus } from "../../types";
import { request } from "../../permissions";
import { uuidv4 } from "../../util";

type OptFields = {
  [opt: string]: {
    description?: string;
    required: boolean;
    title: string;
    type: string;
    placeholder?: string;
    pattern?: string;
    default?: any;
  };
};

export abstract class Registry {
  id: string;
  spec: RegistrySpec;
  priority?: number;
  vendorPrefixes?: string[];
  opts: { [prop: string]: any };
  lastStatus?: RegistryStatus;
  validator: Validator;
  fields: OptFields = {};
  updated: boolean = false;
  obsoleteOptions: string[] = [];

  private walkLock?: ReturnType<Registry["walk"]>;

  constructor(spec: RegistrySpec) {
    const { id, name, kind, priority, vendorPrefixes, ...opts } = spec;
    this.id = id || uuidv4();
    this.spec = { ...spec, id: this.id };

    this.priority = priority;
    this.vendorPrefixes = vendorPrefixes;

    this.opts = opts;
    this.validator = new Validator();
  }

  toJSON() {
    const json = { ...this.spec, ...(this.opts || {}) };
    for (const prop of this.obsoleteOptions) {
      delete json[prop];
    }
    return json;
  }

  protected requestPermissions(...origins: string[]): Promise<void> {
    return request(...origins);
  }

  walk(): ReturnType<Registry["_walk"]> {
    if (this.walkLock) return this.walkLock;
    return (this.walkLock = this._walk().finally(
      () => (this.walkLock = undefined),
    ));
  }

  abstract resolve(_: IgluSchema): Promise<ResolvedIgluSchema>;
  abstract status(): Promise<RegistryStatus>;
  abstract _walk(): Promise<IgluSchema[]>;
}

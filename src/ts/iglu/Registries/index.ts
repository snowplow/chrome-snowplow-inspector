import { RegistrySpec } from "../../types";
import { Registry } from "./Registry";

import { DataStructuresRegistry } from "./DataStructures";
import { IgluRegistry } from "./Iglu";
import { LocalRegistry } from "./Local";
import { StaticRegistry } from "./Static";

export const build = (spec: RegistrySpec): Registry => {
  switch (spec.kind) {
    case "ds":
      return new DataStructuresRegistry(spec);
    case "iglu":
      return new IgluRegistry(spec);
    case "local":
      return new LocalRegistry(spec);
    case "static":
      return new StaticRegistry(spec);
  }
  throw new Error(`Unsupported Registry: ${spec}`);
};

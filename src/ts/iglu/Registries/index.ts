import type { RegistrySpec } from "../../types";
import { Registry } from "./Registry";

import { DataStructuresRegistry } from "./DataStructures";
import { IgluRegistry } from "./Iglu";
import { LocalRegistry } from "./Local";
import { StaticRegistry } from "./Static";

export {
  Registry,
  type RegistrySpec,
  DataStructuresRegistry,
  IgluRegistry,
  LocalRegistry,
  StaticRegistry,
};

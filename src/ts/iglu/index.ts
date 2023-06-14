import {
  Registry,
  DataStructuresRegistry,
  IgluRegistry,
  LocalRegistry,
  StaticRegistry,
} from "./Registries";
import { Resolver } from "./Resolver";
import { $SCHEMA, IgluSchema, ResolvedIgluSchema } from "./IgluSchema";
import type { IgluUri } from "./IgluSchema";
import type {RegistrySpec} from "./Registries";

const build = (spec: RegistrySpec): Registry => {
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

export {
  $SCHEMA,
  build as buildRegistry,
  IgluSchema,
  IgluUri,
  Registry,
  ResolvedIgluSchema,
  Resolver,
};

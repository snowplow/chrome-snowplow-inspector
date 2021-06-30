import { RegistrySpec } from "../types";
import Registry = require("./Registry");

import DataStructuresRegistry = require("./DataStructures");
import IgluRegistry = require("./Iglu");
import LocalRegistry = require("./Local");
import StaticRegistry = require("./Static");

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

export = { build, Registry };

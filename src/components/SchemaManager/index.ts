import m = require("mithril");

import analytics = require("../../ts/analytics");
import Resolver = require("../../ts/Resolver");

import Directory = require("./Directory");
import RegistryList = require("./RegistryList");

const SchemaManager = (vnode: m.Vnode<{ resolver: Resolver }>) => {
  return {
    view: () =>
      m("section.schema-manager.columns.section", [
        m(Directory, vnode.attrs),
        m(RegistryList, vnode.attrs),
      ]),
  };
};

export = SchemaManager;

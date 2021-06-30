import m = require("mithril");
import Resolver = require("../../ts/resolver");

const RegistryList = {
  view: (vnode: m.Vnode<{ resolver: Resolver }>) =>
    m("div.registries.column.is-narrow", "RegistryList goes here"),
};

export = RegistryList;

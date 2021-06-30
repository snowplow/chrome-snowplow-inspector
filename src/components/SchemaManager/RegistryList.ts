import m = require("mithril");

const RegistryList = {
  view: (vnode: m.Vnode<{ resolver: Resolver }>) =>
    m("div.registries.column.is-narrow", "RegistryList goes here"),
};

export = RegistryList;

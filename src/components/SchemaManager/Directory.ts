import m = require("mithril");
import Resolver = require("../../ts/resolver");

const Directory = {
  view: (vnode: m.Vnode<{ resolver: Resolver }>) =>
    m("div.directory.column", "Directory goes here"),
};

export = Directory;

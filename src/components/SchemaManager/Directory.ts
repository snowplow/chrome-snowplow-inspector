import m = require("mithril");

const Directory = {
  view: (vnode: m.Vnode<{ resolver: Resolver }>) =>
    m("div.directory.column", "Directory goes here"),
};

export = Directory;

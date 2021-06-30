import m = require("mithril");

abstract class Registry {
  abstract walk(): void; // Iterate over available schemas?
  abstract view(): m.Vnode; // Should render the Registry as a list item or form for editing
}

export = Registry;

import { default as m, Vnode } from "mithril";

import { Resolver } from "../../ts/iglu";

import { Directory } from "./Directory";
import { RegistryList } from "./RegistryList";

export const SchemaManager = (vnode: Vnode<{ resolver: Resolver }>) => {
  return {
    view: () =>
      m("section.schema-manager.columns.section", [
        m(Directory, vnode.attrs),
        m(RegistryList, vnode.attrs),
      ]),
  };
};

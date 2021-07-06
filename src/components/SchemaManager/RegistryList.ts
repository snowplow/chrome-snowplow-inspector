import { default as m, Vnode } from "mithril";
import { Resolver } from "../../ts/iglu";

export const RegistryList = {
  view: (vnode: Vnode<{ resolver: Resolver }>) =>
    m("div.registries.column.is-narrow", m(vnode.attrs.resolver)),
};

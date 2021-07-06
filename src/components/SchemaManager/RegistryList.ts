import { default as m, Vnode } from "mithril";
import { Resolver } from "../../ts/iglu/Resolver";

export const RegistryList = {
  view: (vnode: Vnode<{ resolver: Resolver }>) =>
    m("div.registries.column.is-narrow", "RegistryList goes here"),
};
